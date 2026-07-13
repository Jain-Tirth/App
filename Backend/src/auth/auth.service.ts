import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokens, AuthUserResponse, AuthenticatedUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
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

    const existingUsers = await this.prisma.user.findMany({
      where: {
        OR: [{ email }, { mobile }],
      },
      orderBy: { createdAt: 'asc' },
    });

    const reusableUser = this.resolveReusableUser(existingUsers);
    const passwordHash = await bcrypt.hash(registerDto.password, BCRYPT_ROUNDS);

    const user = reusableUser
      ? await this.prisma.user.update({
          where: { id: reusableUser.id },
          data: {
            name: registerDto.fullName.trim(),
            email,
            passwordHash,
            mobile,
            profileCreatedBy: registerDto.profileCreatedBy,
            gender: registerDto.gender ?? reusableUser.gender,
            accountStatus: AccountStatus.pending,
            rejectionReason: null,
            mobileVerified: false,
            otpCode: null,
            otpExpiresAt: null,
            otpRequestCount: 0,
            otpWindowStartedAt: null,
            refreshTokenHash: null,
            refreshTokenExpiresAt: null,
          },
        })
      : await this.prisma.user.create({
          data: {
            name: registerDto.fullName.trim(),
            email,
            passwordHash,
            mobile,
            profileCreatedBy: registerDto.profileCreatedBy,
            gender: registerDto.gender,
          },
        });

    const otp = await this.otpService.issueOtp(user);

    return {
      message: 'Registration started. Verify the OTP to continue.',
      userId: user.id,
      mobile: user.mobile,
      otpExpiresAt: otp.expiresAt,
      otpCode: this.includeOtpInResponse() ? otp.otpCode : undefined,
    };
  }

  async resendOtp(resendOtpDto: ResendOtpDto) {
    const mobile = this.normalizeMobile(
      resendOtpDto.countryCode,
      resendOtpDto.mobileNumber,
    );

    const user = await this.prisma.user.findUnique({
      where: { mobile },
    });

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
      otpExpiresAt: otp.expiresAt,
      otpCode: this.includeOtpInResponse() ? otp.otpCode : undefined,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const mobile = this.normalizeMobile(
      verifyOtpDto.countryCode,
      verifyOtpDto.mobileNumber,
    );

    const user = await this.prisma.user.findUnique({
      where: { mobile },
    });

    if (!user) {
      throw new BadRequestException('No account found for this mobile number.');
    }

    this.otpService.assertValidOtp(user, verifyOtpDto.otpCode);

    const tokens = await this.generateTokens(user);
    const refreshTokenHash = await bcrypt.hash(
      tokens.refreshToken,
      BCRYPT_ROUNDS,
    );

    const verifiedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mobileVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        otpRequestCount: 0,
        otpWindowStartedAt: null,
        refreshTokenHash,
        refreshTokenExpiresAt: this.getRefreshTokenExpiryDate(),
        lastSeen: new Date(),
      },
    });

    return {
      message: 'OTP verified successfully.',
      user: this.toAuthUserResponse(verifiedUser),
      tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
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

    if (user.accountStatus === AccountStatus.blocked) {
      throw new ForbiddenException(
        `This account is ${user.accountStatus}. Contact support for help.`,
      );
    }

    if (user.accountStatus === AccountStatus.rejected) {
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

    const loggedInUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash,
        refreshTokenExpiresAt: this.getRefreshTokenExpiryDate(),
        lastSeen: new Date(),
      },
    });

    return {
      message: 'Login successful.',
      user: this.toAuthUserResponse(loggedInUser),
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

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (
      !user ||
      !user.refreshTokenHash ||
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    const tokenMatches = await bcrypt.compare(
      refreshTokenDto.refreshToken,
      user.refreshTokenHash,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const tokens = await this.generateTokens(user);
    const refreshTokenHash = await bcrypt.hash(
      tokens.refreshToken,
      BCRYPT_ROUNDS,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash,
        refreshTokenExpiresAt: this.getRefreshTokenExpiryDate(),
        lastSeen: new Date(),
      },
    });

    return {
      message: 'Token refreshed successfully.',
      tokens,
    };
  }

  async logout(user: AuthenticatedUser) {
    await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });

    return {
      message: 'Logout successful.',
    };
  }

  private resolveReusableUser(users: User[]): User | null {
    if (users.length === 0) {
      return null;
    }

    if (users.some((user) => user.mobileVerified)) {
      throw new ConflictException('An account already exists with these details.');
    }

    const uniqueIds = new Set(users.map((user) => user.id));
    if (uniqueIds.size > 1) {
      throw new ConflictException(
        'This email or mobile number is already reserved by another pending account.',
      );
    }

    const user = users[0];
    if (
      user.accountStatus !== AccountStatus.pending &&
      user.accountStatus !== AccountStatus.rejected
    ) {
      throw new ConflictException('An account already exists with these details.');
    }

    return user;
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role ?? Role.user,
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

  private toAuthUserResponse(user: User): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      role: user.role,
      accountStatus: user.accountStatus,
      mobileVerified: user.mobileVerified,
      profileCreatedBy: user.profileCreatedBy,
    };
  }

  private includeOtpInResponse(): boolean {
    return this.configService.get<string>('NODE_ENV') !== 'production';
  }

  private normalizeMobile(countryCode: string, mobileNumber: string): string {
    return `${countryCode}${mobileNumber}`;
  }
}
