import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const OTP_EXPIRY_MINUTES = 10;
const OTP_WINDOW_MINUTES = 10;
const OTP_REQUEST_LIMIT = 5;

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService) {}

  async issueOtp(user: User): Promise<{ otpCode: string; expiresAt: Date }> {
    const now = new Date();
    const windowStartedAt = user.otpWindowStartedAt ?? now;
    const windowExpiresAt = new Date(
      windowStartedAt.getTime() + OTP_WINDOW_MINUTES * 60 * 1000,
    );

    const requestCount =
      windowExpiresAt <= now ? 0 : (user.otpRequestCount ?? 0);

    if (requestCount >= OTP_REQUEST_LIMIT) {
      throw new HttpException(
        'OTP request limit exceeded. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otpCode = randomInt(1000, 10000).toString();
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

  assertValidOtp(user: User, otpCode: string): void {
    if (!user.otpCode || !user.otpExpiresAt) {
      throw new BadRequestException('No OTP has been generated for this user.');
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP has expired.');
    }

    if (user.otpCode !== otpCode) {
      throw new BadRequestException('Invalid OTP.');
    }
  }
}
