import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'crypto';

export interface OtpIssueResult {
  otpCode: string;
  otpToken: string;
  expiresAt: Date;
}

interface OtpPayload {
  sub: string;
  mobile: string;
  encryptedCode: string;
  iv: string;
  exp: number;
}

const OTP_EXPIRY_MINUTES = 5;

@Injectable()
export class OtpService {
  private readonly jwtSecret: string;
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'fallback-secret-key-at-least-32-chars';
    // Generate a consistent 32-byte key for AES-256-CBC from JWT_SECRET
    this.encryptionKey = createHash('sha256').update(this.jwtSecret).digest();
  }

  async issueOtp(user: { id: string; mobile: string }): Promise<OtpIssueResult> {
    const otpCode = randomInt(1000, 10000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Encrypt the OTP code using AES-256-CBC
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encryptedCode = cipher.update(otpCode, 'utf8', 'hex');
    encryptedCode += cipher.final('hex');

    const payload: Omit<OtpPayload, 'exp'> = {
      sub: user.id,
      mobile: user.mobile,
      encryptedCode,
      iv: iv.toString('hex'),
    };

    const otpToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: `${OTP_EXPIRY_MINUTES}m`,
    });

    return { otpCode, otpToken, expiresAt };
  }

  verifyOtpToken(
    otpToken: string,
    expectedMobile: string,
    enteredOtpCode: string,
  ): string {
    let payload: OtpPayload;
    try {
      payload = this.jwtService.verify<OtpPayload>(otpToken, {
        secret: this.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('OTP session token is invalid or has expired.');
    }

    if (payload.mobile !== expectedMobile) {
      throw new BadRequestException('OTP token does not match the provided mobile number.');
    }

    try {
      const iv = Buffer.from(payload.iv, 'hex');
      const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decryptedCode = decipher.update(payload.encryptedCode, 'hex', 'utf8');
      decryptedCode += decipher.final('utf8');

      if (decryptedCode !== enteredOtpCode) {
        throw new BadRequestException('Invalid OTP.');
      }

      return payload.sub;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Failed to decrypt OTP verification token.');
    }
  }
}
