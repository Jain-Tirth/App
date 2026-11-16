import { Inject, Injectable, Logger } from '@nestjs/common';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage';
import {
  ACCOUNT_CLOCK,
  PURGE_REPOSITORY,
  type Clock,
  type PurgeRepository,
} from './account.types';

export interface PurgeResult {
  purged: number;
  failed: number;
}

/**
 * Removes every account whose cooling-off has ended. Run on a schedule or with
 * `npm run account:purge`; `now` is a parameter so tests can move the clock.
 */
@Injectable()
export class AccountPurgeService {
  private readonly logger = new Logger(AccountPurgeService.name);

  constructor(
    @Inject(PURGE_REPOSITORY) private readonly repository: PurgeRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(ACCOUNT_CLOCK) private readonly clock: Clock,
  ) {}

  async run(now: Date = this.clock()): Promise<PurgeResult> {
    const due = await this.repository.findDue(now);
    const result: PurgeResult = { purged: 0, failed: 0 };

    for (const { userId } of due) {
      try {
        // Stored files go first: removing a missing object is a no-op, so a
        // failure after this point can be retried by the next run.
        for (const key of await this.repository.findStorageKeys(userId)) {
          await this.storage.remove(key);
        }

        if (await this.repository.purge(userId, now)) {
          result.purged += 1;
        }
      } catch (error) {
        result.failed += 1;
        this.logger.error(
          `Purge of ${userId} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return result;
  }
}
