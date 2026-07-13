import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import type { AuthenticatedUser } from './auth.types';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
        user: import("./auth.types").AuthUserResponse;
        tokens: import("./auth.types").AuthTokens;
    }>;
    login(loginDto: LoginDto): Promise<{
        message: string;
        user: import("./auth.types").AuthUserResponse;
        tokens: import("./auth.types").AuthTokens;
    }>;
    refresh(refreshTokenDto: RefreshTokenDto): Promise<{
        message: string;
        tokens: import("./auth.types").AuthTokens;
    }>;
    logout(user: AuthenticatedUser): Promise<{
        message: string;
    }>;
}
