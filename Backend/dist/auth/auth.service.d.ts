import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokens, AuthUserResponse, AuthenticatedUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly configService;
    private readonly otpService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService, otpService: OtpService);
    register(registerDto: RegisterDto): Promise<{
        message: string;
        userId: string;
        mobile: string;
        otpExpiresAt: Date;
        otpCode: string | undefined;
    }>;
    resendOtp(resendOtpDto: ResendOtpDto): Promise<{
        message: string;
        mobile: string;
        otpExpiresAt: Date;
        otpCode: string | undefined;
    }>;
    verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{
        message: string;
        user: AuthUserResponse;
        tokens: AuthTokens;
    }>;
    login(loginDto: LoginDto): Promise<{
        message: string;
        user: AuthUserResponse;
        tokens: AuthTokens;
    }>;
    refreshTokens(refreshTokenDto: RefreshTokenDto): Promise<{
        message: string;
        tokens: AuthTokens;
    }>;
    logout(user: AuthenticatedUser): Promise<{
        message: string;
    }>;
    private resolveReusableUser;
    private generateTokens;
    private getRefreshTokenExpiryDate;
    private toAuthUserResponse;
    private includeOtpInResponse;
    private normalizeMobile;
}
