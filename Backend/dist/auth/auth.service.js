"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const otp_service_1 = require("./otp.service");
const BCRYPT_ROUNDS = 12;
let AuthService = class AuthService {
    prisma;
    jwtService;
    configService;
    otpService;
    constructor(prisma, jwtService, configService, otpService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
        this.otpService = otpService;
    }
    async register(registerDto) {
        const email = registerDto.email.trim().toLowerCase();
        const mobile = this.normalizeMobile(registerDto.countryCode, registerDto.mobileNumber);
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
                    accountStatus: client_1.AccountStatus.pending,
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
    async resendOtp(resendOtpDto) {
        const mobile = this.normalizeMobile(resendOtpDto.countryCode, resendOtpDto.mobileNumber);
        const user = await this.prisma.user.findUnique({
            where: { mobile },
        });
        if (!user) {
            throw new common_1.BadRequestException('No account found for this mobile number.');
        }
        if (user.mobileVerified) {
            throw new common_1.BadRequestException('This mobile number is already verified.');
        }
        const otp = await this.otpService.issueOtp(user);
        return {
            message: 'OTP resent successfully.',
            mobile: user.mobile,
            otpExpiresAt: otp.expiresAt,
            otpCode: this.includeOtpInResponse() ? otp.otpCode : undefined,
        };
    }
    async verifyOtp(verifyOtpDto) {
        const mobile = this.normalizeMobile(verifyOtpDto.countryCode, verifyOtpDto.mobileNumber);
        const user = await this.prisma.user.findUnique({
            where: { mobile },
        });
        if (!user) {
            throw new common_1.BadRequestException('No account found for this mobile number.');
        }
        this.otpService.assertValidOtp(user, verifyOtpDto.otpCode);
        const tokens = await this.generateTokens(user);
        const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, BCRYPT_ROUNDS);
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
    async login(loginDto) {
        const email = loginDto.email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid email or password.');
        }
        const passwordMatches = await bcrypt.compare(loginDto.password, user.passwordHash);
        if (!passwordMatches) {
            throw new common_1.UnauthorizedException('Invalid email or password.');
        }
        if (!user.mobileVerified) {
            throw new common_1.ForbiddenException('Verify your mobile number before logging in.');
        }
        if (user.accountStatus === client_1.AccountStatus.blocked) {
            throw new common_1.ForbiddenException(`This account is ${user.accountStatus}. Contact support for help.`);
        }
        if (user.accountStatus === client_1.AccountStatus.rejected) {
            throw new common_1.ForbiddenException(user.rejectionReason
                ? `This account is rejected: ${user.rejectionReason}`
                : 'This account is rejected. Contact support for help.');
        }
        const tokens = await this.generateTokens(user);
        const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, BCRYPT_ROUNDS);
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
    async refreshTokens(refreshTokenDto) {
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(refreshTokenDto.refreshToken, {
                secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid refresh token.');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
        });
        if (!user ||
            !user.refreshTokenHash ||
            !user.refreshTokenExpiresAt ||
            user.refreshTokenExpiresAt.getTime() < Date.now()) {
            throw new common_1.UnauthorizedException('Refresh token has expired.');
        }
        const tokenMatches = await bcrypt.compare(refreshTokenDto.refreshToken, user.refreshTokenHash);
        if (!tokenMatches) {
            throw new common_1.UnauthorizedException('Invalid refresh token.');
        }
        const tokens = await this.generateTokens(user);
        const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, BCRYPT_ROUNDS);
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
    async logout(user) {
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
    resolveReusableUser(users) {
        if (users.length === 0) {
            return null;
        }
        if (users.some((user) => user.mobileVerified)) {
            throw new common_1.ConflictException('An account already exists with these details.');
        }
        const uniqueIds = new Set(users.map((user) => user.id));
        if (uniqueIds.size > 1) {
            throw new common_1.ConflictException('This email or mobile number is already reserved by another pending account.');
        }
        const user = users[0];
        if (user.accountStatus !== client_1.AccountStatus.pending &&
            user.accountStatus !== client_1.AccountStatus.rejected) {
            throw new common_1.ConflictException('An account already exists with these details.');
        }
        return user;
    }
    async generateTokens(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role ?? client_1.Role.user,
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow('JWT_SECRET'),
                expiresIn: this.configService.get('JWT_EXPIRES_IN', '7d'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '30d'),
            }),
        ]);
        return { accessToken, refreshToken };
    }
    getRefreshTokenExpiryDate() {
        const now = new Date();
        now.setDate(now.getDate() + 30);
        return now;
    }
    toAuthUserResponse(user) {
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
    includeOtpInResponse() {
        return this.configService.get('NODE_ENV') !== 'production';
    }
    normalizeMobile(countryCode, mobileNumber) {
        return `${countryCode}${mobileNumber}`;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        otp_service_1.OtpService])
], AuthService);
//# sourceMappingURL=auth.service.js.map