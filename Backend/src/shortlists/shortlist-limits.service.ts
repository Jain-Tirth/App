import { Inject, Injectable } from '@nestjs/common';
import { shortlistLimitExceeded } from './shortlist.errors';
import { SHORTLIST_CONFIG, type ShortlistConfig } from './shortlist.types';

/**
 * The single place shortlist limits are decided. A `null` limit means
 * unlimited, which is the default; a later tier or configuration change only
 * supplies different numbers.
 */
@Injectable()
export class ShortlistLimitsService {
  constructor(@Inject(SHORTLIST_CONFIG) private readonly config: ShortlistConfig) {}

  /** `existingLists` is how many lists the member already has. */
  assertCanCreateList(existingLists: number): void {
    const max = this.config.maxLists;

    if (max !== null && existingLists >= max) {
      throw shortlistLimitExceeded('lists', max);
    }
  }

  /**
   * `distinctProfiles` is how many different profiles the member has across all
   * lists. A profile already shortlisted elsewhere adds nothing new.
   */
  assertCanAddProfile(distinctProfiles: number, alreadyShortlisted: boolean): void {
    const max = this.config.maxProfiles;

    if (max !== null && !alreadyShortlisted && distinctProfiles >= max) {
      throw shortlistLimitExceeded('profiles', max);
    }
  }
}
