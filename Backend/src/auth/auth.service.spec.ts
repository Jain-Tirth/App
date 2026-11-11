import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { ConsentsService } from '../consents/consents.service';
import type { ValidatedConsent } from '../consents/consent.types';
import type { ClientRequestContext } from '../common/request-context';
import type { DatabaseClient } from '../database/database.types';
import type { DatabaseService } from '../database/database.service';
import { AuthService } from './auth.service';
import { ProfileCreatedBy, type RegisterDto } from './dto/register.dto';
import type { OtpService } from './otp.service';

interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  mobileVerified: boolean;
  role: string;
  accountStatus: string;
}

const CREATED_USER: RegisteredUser = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Asha Patel',
  email: 'asha@example.com',
  mobile: '+919876543210',
  mobileVerified: false,
  role: 'user',
  accountStatus: 'active',
};

/**
 * Test double for the DatabaseService transaction port. Rows created inside the
 * callback are staged and only become visible when the callback resolves, so a
 * rejected callback leaves no user behind — the contract the real Postgres
 * adapter implements with BEGIN / COMMIT / ROLLBACK.
 */
class FakeDatabaseService {
  committed: RegisteredUser[] = [];
  commits = 0;
  rollbacks = 0;
  failWith: Error | null = null;
  readonly transactionClient: DatabaseClient = {
    query: async () => ({ rows: [] }),
  };
  private staged: RegisteredUser[] = [];

  async callFunction<T>(
    funcName: string,
    params: any[],
    client?: DatabaseClient,
  ): Promise<T[]> {
    if (funcName !== 'fn_register_user') {
      throw new Error(`Unexpected database function: ${funcName}`);
    }

    if (client !== this.transactionClient) {
      throw new Error(
        'fn_register_user must run on the registration transaction client',
      );
    }

    if (this.failWith) {
      throw this.failWith;
    }

    const user: RegisteredUser = {
      ...CREATED_USER,
      name: params[0],
      email: params[1],
      mobile: params[3],
    };
    this.staged.push(user);
    return [user as unknown as T];
  }

  async transaction<T>(
    callback: (client: DatabaseClient) => Promise<T>,
  ): Promise<T> {
    try {
      const result = await callback(this.transactionClient);
      this.committed.push(...this.staged);
      this.staged = [];
      this.commits += 1;
      return result;
    } catch (error) {
      this.staged = [];
      this.rollbacks += 1;
      throw error;
    }
  }
}

class FakeConsentsService {
  failOnRecord: Error | null = null;
  recorded: Array<{ user: { id: string; name: string }; client?: DatabaseClient }> =
    [];

  async validateRegistrationConsents(
    inputs: any[],
  ): Promise<ValidatedConsent[]> {
    return inputs as unknown as ValidatedConsent[];
  }

  async recordRegistrationConsents(
    user: { id: string; name: string },
    _accepted: ValidatedConsent[],
    _context: ClientRequestContext,
    client?: DatabaseClient,
  ) {
    if (this.failOnRecord) {
      throw this.failOnRecord;
    }

    this.recorded.push({ user, client });
    return [];
  }
}

const registerDto = (): RegisterDto =>
  ({
    fullName: 'Asha Patel',
    email: 'asha@example.com',
    password: 'sup3r-secret',
    countryCode: '+91',
    mobileNumber: '9876543210',
    profileCreatedBy: ProfileCreatedBy.myself,
    consents: [
      { code: 'terms', version: '1.0', documentHash: 'a'.repeat(64) },
      { code: 'privacy', version: '1.0', documentHash: 'a'.repeat(64) },
      { code: 'id_processing', version: '1.0', documentHash: 'a'.repeat(64) },
    ],
  }) as RegisterDto;

const context: ClientRequestContext = {
  ip: '203.0.113.5',
  userAgent: 'jest-agent',
  language: 'en',
};

describe('AuthService registration', () => {
  let db: FakeDatabaseService;
  let consents: FakeConsentsService;
  let otp: { issueOtp: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    db = new FakeDatabaseService();
    consents = new FakeConsentsService();
    otp = {
      issueOtp: jest.fn(async () => ({
        otpCode: '1234',
        otpToken: 'otp-token',
        expiresAt: new Date('2026-11-10T10:05:00.000Z'),
      })),
    };

    service = new AuthService(
      db as unknown as DatabaseService,
      {} as JwtService,
      { get: () => 'test' } as unknown as ConfigService,
      otp as unknown as OtpService,
      consents as unknown as ConsentsService,
    );
  });

  it('writes the account and every consent record inside one transaction', async () => {
    const result = await service.register(registerDto(), context);

    expect(db.commits).toBe(1);
    expect(db.rollbacks).toBe(0);
    expect(db.committed).toHaveLength(1);
    expect(consents.recorded).toHaveLength(1);
    expect(consents.recorded[0].user).toEqual({
      id: db.committed[0].id,
      name: 'Asha Patel',
    });
    expect(consents.recorded[0].client).toBe(db.transactionClient);
    expect(otp.issueOtp).toHaveBeenCalledWith(db.committed[0]);
    expect(result.userId).toBe(db.committed[0].id);
  });

  it('rolls the account back when the consent insert fails', async () => {
    consents.failOnRecord = new Error('consent insert failed');

    await expect(service.register(registerDto(), context)).rejects.toThrow(
      'consent insert failed',
    );

    expect(db.rollbacks).toBe(1);
    expect(db.commits).toBe(0);
    expect(db.committed).toHaveLength(0);
    expect(consents.recorded).toHaveLength(0);
    expect(otp.issueOtp).not.toHaveBeenCalled();
  });

  it('translates USER_EXISTS into a conflict after rolling back', async () => {
    db.failWith = new Error('USER_EXISTS: an account already exists');

    await expect(service.register(registerDto(), context)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(db.rollbacks).toBe(1);
    expect(db.committed).toHaveLength(0);
    expect(consents.recorded).toHaveLength(0);
  });
});
