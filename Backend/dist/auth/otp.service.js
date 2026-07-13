"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const OTP_EXPIRY_MINUTES = 10;
const OTP_WINDOW_MINUTES = 10;
const OTP_REQUEST_LIMIT = 5;
let OtpService = class OtpService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async issueOtp(user) {
        const now = new Date();
        const windowStartedAt = user.otpWindowStartedAt ?? now;
        const windowExpiresAt = new Date(windowStartedAt.getTime() + OTP_WINDOW_MINUTES * 60 * 1000);
        const requestCount = windowExpiresAt <= now ? 0 : (user.otpRequestCount ?? 0);
        if (requestCount >= OTP_REQUEST_LIMIT) {
            throw new common_1.HttpException('OTP request limit exceeded. Try again later.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const otpCode = (0, crypto_1.randomInt)(1000, 10000).toString();
        const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                otpCode,
                otpExpiresAt: expiresAt,
                otpRequestCount: requestCount + 1,
                otpWindowStartedAt: requestCount === 0 ? now : windowStartedAt,
            },
        });
        return { otpCode, expiresAt };
    }
    assertValidOtp(user, otpCode) {
        if (!user.otpCode || !user.otpExpiresAt) {
            throw new common_1.BadRequestException('No OTP has been generated for this user.');
        }
        if (user.otpExpiresAt.getTime() < Date.now()) {
            throw new common_1.BadRequestException('OTP has expired.');
        }
        if (user.otpCode !== otpCode) {
            throw new common_1.BadRequestException('Invalid OTP.');
        }
    }
};
exports.OtpService = OtpService;
exports.OtpService = OtpService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OtpService);
//# sourceMappingURL=otp.service.js.map