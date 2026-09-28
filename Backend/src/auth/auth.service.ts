import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { DatabaseService } from '../database/database.service';
import { AuthTokens, AuthUserResponse, AuthenticatedUser, Role, AccountStatus, ProfileCreatedBy, Gender } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';

const BCRYPT_ROUNDS = 12;

interface DbUserRow {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  mobile: string;
  mobileVerified: boolean;
  emailVerified?: boolean;
  role: Role;
  membershipType?: string;
  accountStatus: AccountStatus;
  rejectionReason?: string | null;
  profileCreatedBy?: ProfileCreatedBy | null;
  gender?: Gender | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
  ) {}

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.trim().toLowerCase();
    const mobile = this.normalizeMobile(
      registerDto.countryCode,
      registerDto.mobileNumber,
    );
    const passwordHash = await bcrypt.hash(registerDto.password, BCRYPT_ROUNDS);

    let user: DbUserRow;
    try {
      const rows = await this.db.callFunction<DbUserRow>('fn_register_user', [
        registerDto.fullName.trim(),
        email,
        passwordHash,
        mobile,
        registerDto.profileCreatedBy,
        registerDto.gender ?? null,
      ]);
      user = rows[0];
    } catch (error: any) {
      if (error?.message?.includes('USER_EXISTS')) {
        throw new ConflictException('An account already exists with these details.');
      }
      throw error;
    }

    const otp = await this.otpService.issueOtp(user);

    return {
      message: 'Registration started. Verify the OTP to continue.',
      userId: user.id,
      mobile: user.mobile,
      otpToken: otp.otpToken,
      otpExpiresAt: otp.expiresAt,
      otpCode: this.includeOtpInResponse() ? otp.otpCode : undefined,
    };
  }

  async resendOtp(resendOtpDto: ResendOtpDto) {
    const mobile = this.normalizeMobile(
      resendOtpDto.countryCode,
      resendOtpDto.mobileNumber,
    );

    const user = await this.db.callFunctionSingle<DbUserRow>(
      'fn_get_user_by_identifier',
      [mobile],
    );

    if (!user) {
      throw new BadRequestException('No account found for this mobile number.');
    }

    if (user.mobileVerified) {
      throw new BadRequestException('This mobile number is already verified.');
    }

    const otp = await this.otpService.issueOtp(user);

    return {
      message: 'OTP resent successfully.',
      mobile: user.mobile,
      otpToken: otp.otpToken,
      otpExpiresAt: otp.expiresAt,
      otpCode: this.includeOtpInResponse() ? otp.otpCode : undefined,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const mobile = this.normalizeMobile(
      verifyOtpDto.countryCode,
      verifyOtpDto.mobileNumber,
    );

    const user = await this.db.callFunctionSingle<DbUserRow>(
      'fn_get_user_by_identifier',
      [mobile],
    );

    if (!user) {
      throw new BadRequestException('No account found for this mobile number.');
    }

    // Verify stateless encrypted JWT token
    if (verifyOtpDto.otpToken) {
      this.otpService.verifyOtpToken(
        verifyOtpDto.otpToken,
        mobile,
        verifyOtpDto.otpCode,
      );
    }

    // Call stored procedure/function to mark verified
    const verifiedUsers = await this.db.callFunction<DbUserRow>(
      'fn_verify_user_mobile',
      [user.id],
    );
    const verifiedUser = verifiedUsers[0];

    const tokens = await this.generateTokens(verifiedUser);
    const refreshTokenHash = await bcrypt.hash(
      tokens.refreshToken,
      BCRYPT_ROUNDS,
    );

    await this.db.callFunction('fn_save_user_session', [
      verifiedUser.id,
      refreshTokenHash,
      this.getRefreshTokenExpiryDate(),
    ]);

    return {
      message: 'OTP verified successfully.',
      user: this.toAuthUserResponse(verifiedUser),
      tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const user = await this.db.callFunctionSingle<DbUserRow>(
      'fn_get_user_by_identifier',
      [email],
    );

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.mobileVerified) {
      throw new ForbiddenException('Verify your mobile number before logging in.');
    }

    if (user.accountStatus === 'blocked') {
      throw new ForbiddenException(
        `This account is ${user.accountStatus}. Contact support for help.`,
      );
    }

    if (user.accountStatus === 'rejected') {
      throw new ForbiddenException(
        user.rejectionReason
          ? `This account is rejected: ${user.rejectionReason}`
          : 'This account is rejected. Contact support for help.',
      );
    }

    const tokens = await this.generateTokens(user);
    const refreshTokenHash = await bcrypt.hash(
      tokens.refreshToken,
      BCRYPT_ROUNDS,
    );

    await this.db.callFunction('fn_save_user_session', [
      user.id,
      refreshTokenHash,
      this.getRefreshTokenExpiryDate(),
    ]);

    return {
      message: 'Login successful.',
      user: this.toAuthUserResponse(user),
      tokens,
    };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    let payload: AuthenticatedUser;

    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedUser>(
        refreshTokenDto.refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const session = await this.db.callFunctionSingle<{
      userId: string;
      refreshTokenHash: string;
      refreshTokenExpiresAt: Date;
    }>('fn_get_user_session', [payload.sub]);

    if (
      !session ||
      !session.refreshTokenHash ||
      !session.refreshTokenExpiresAt ||
      new Date(session.refreshTokenExpiresAt).getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    const tokenMatches = await bcrypt.compare(
      refreshTokenDto.refreshToken,
      session.refreshTokenHash,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.db.callFunctionSingle<DbUserRow>(
      'fn_get_user_by_identifier',
      [payload.email],
    );

    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }

    const tokens = await this.generateTokens(user);
    const refreshTokenHash = await bcrypt.hash(
      tokens.refreshToken,
      BCRYPT_ROUNDS,
    );

    await this.db.callFunction('fn_save_user_session', [
      user.id,
      refreshTokenHash,
      this.getRefreshTokenExpiryDate(),
    ]);

    return {
      message: 'Token refreshed successfully.',
      tokens,
    };
  }

  async logout(user: AuthenticatedUser) {
    await this.db.callFunction('fn_clear_user_session', [user.sub]);

    return {
      message: 'Logout successful.',
    };
  }

  private async generateTokens(user: { id: string; email: string; role?: Role }): Promise<AuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role ?? 'user',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_EXPIRES_IN',
          '7d',
        ) as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '30d',
        ) as StringValue,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private getRefreshTokenExpiryDate(): Date {
    const now = new Date();
    now.setDate(now.getDate() + 30);
    return now;
  }

  private toAuthUserResponse(user: DbUserRow): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      role: user.role,
      accountStatus: user.accountStatus,
      mobileVerified: user.mobileVerified,
      profileCreatedBy: user.profileCreatedBy ?? null,
    };
  }

  private includeOtpInResponse(): boolean {
    return this.configService.get<string>('NODE_ENV') !== 'production';
  }

  private normalizeMobile(countryCode: string, mobileNumber: string): string {
    return `${countryCode}${mobileNumber}`;
  }
}
