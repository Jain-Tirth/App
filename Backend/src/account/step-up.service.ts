import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { stepUpRetryAfterSeconds, stepUpWindowStart } from './account.domain';
import { stepUpFailed, stepUpRateLimited } from './account.errors';
import {
  ACCOUNT_CLOCK,
  ACCOUNT_CONFIG,
  STEP_UP_REPOSITORY,
  type AccountConfig,
  type Clock,
  type StepUpRepository,
} from './account.types';

/**
 * Re-verifies the member's password before a sensitive action (SEC-07,
 * SEC-46). Failures are counted per member over a window; once the limit is
 * reached the next attempt is refused without comparing the password.
 */
@Injectable()
export class StepUpService {
  constructor(
    @Inject(STEP_UP_REPOSITORY) private readonly repository: StepUpRepository,
    @Inject(ACCOUNT_CONFIG) private readonly config: AccountConfig,
    @Inject(ACCOUNT_CLOCK) private readonly clock: Clock,
  ) {}

  async verify(userId: string, password: string): Promise<void> {
    const now = this.clock();
    const window = await this.repository.failuresSince(
      userId,
      stepUpWindowStart(now, this.config.stepUpWindowMinutes),
    );

    if (window.count >= this.config.stepUpMaxFailures && window.oldestAt) {
      throw stepUpRateLimited(
        stepUpRetryAfterSeconds(window.oldestAt, now, this.config.stepUpWindowMinutes),
      );
    }

    const hash = await this.repository.findPasswordHash(userId);
    const matches = hash ? await bcrypt.compare(password, hash) : false;

    if (!matches) {
      await this.repository.recordFailure(userId, now);
      throw stepUpFailed();
    }
  }
}
