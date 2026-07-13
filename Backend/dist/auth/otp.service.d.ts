import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export declare class OtpService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    issueOtp(user: User): Promise<{
        otpCode: string;
        expiresAt: Date;
    }>;
    assertValidOtp(user: User, otpCode: string): void;
}
