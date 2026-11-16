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

type Outcome =
  | { kind: 'verified' }
  | { kind: 'wrong' }
  | { kind: 'limited'; retryAfterSeconds: number };

/**
 * Re-verifies the member's password before a sensitive action (SEC-07,
 * SEC-46). Failures are counted per member over a window; once the limit is
 * reached the next attempt is refused without comparing the password. The
 * count, the comparison and the failure insert happen under one per-member
 * lock, so parallel attempts are counted one after another.
 */
@Injectable()
export class StepUpService {
  constructor(
    @Inject(STEP_UP_REPOSITORY) private readonly repository: StepUpRepository,
    @Inject(ACCOUNT_CONFIG) private readonly config: AccountConfig,
    @Inject(ACCOUNT_CLOCK) private readonly clock: Clock,
  ) {}

  async verify(userId: string, password: string): Promise<void> {
    const outcome = await this.repository.runExclusive<Outcome>(
      userId,
      async (attempt) => {
        const now = this.clock();
        const window = await attempt.failuresSince(
          stepUpWindowStart(now, this.config.stepUpWindowMinutes),
        );

        if (window.count >= this.config.stepUpMaxFailures && window.oldestAt) {
          return {
            kind: 'limited',
            retryAfterSeconds: stepUpRetryAfterSeconds(
              window.oldestAt,
              now,
              this.config.stepUpWindowMinutes,
            ),
          };
        }

        const hash = await attempt.findPasswordHash();

        if (hash && (await bcrypt.compare(password, hash))) {
          return { kind: 'verified' };
        }

        await attempt.recordFailure(now);

        return { kind: 'wrong' };
      },
    );

    if (outcome.kind === 'limited') {
      throw stepUpRateLimited(outcome.retryAfterSeconds);
    }

    if (outcome.kind === 'wrong') {
      throw stepUpFailed();
    }
  }
}
