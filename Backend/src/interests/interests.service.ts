import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiException } from '../common/api-error';
import { profileNotFound } from '../discovery/discovery.errors';
import {
  DISCOVERY_REPOSITORY,
  type AgeMinimums,
  type DiscoveryCard,
  type DiscoveryRepository,
} from '../discovery/discovery.types';
import { REVIEW_NOTES_MAX, type AuditContext } from '../admin/review/review.types';
import { decodeInterestCursor, encodeInterestCursor } from './interest-cursor';
import {
  assertWithinDailySendLimit,
  canChat,
  cooldownEndsAt,
  decideTransition,
  isCooldownActive,
} from './interest.domain';
import {
  cannotInterestSelf,
  cooldownNotFound,
  interestAlreadyExists,
  interestCooldown,
  interestNotFound,
  invalidInterestTransition,
} from './interest.errors';
import {
  DEFAULT_INTEREST_PAGE_SIZE,
  INTEREST_AGE_MINIMUMS,
  INTEREST_CLOCK,
  INTEREST_CONFIG,
  INTEREST_REPOSITORY,
  type InterestAction,
  type InterestConfig,
  type InterestDirection,
  type InterestRecord,
  type InterestRepository,
  type InterestStatus,
} from './interest.types';

const PROFILE_REF = /^[0-9a-f]{32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reasons an admin may give for lifting a cooldown. */
export const COOLDOWN_REASON_CODES = [
  'member-appeal',
  'admin-error',
  'goodwill',
  'other',
] as const;

export interface InterestView {
  id: string;
  status: InterestStatus;
  /** "Not accepted" for the sender of a declined interest; never a reason. */
  statusLabel: string | null;
  canChat: boolean;
  createdAt: string;
  respondedAt: string | null;
}

export interface InterestListItem extends InterestView {
  member: DiscoveryCard;
}

export interface ClearCooldownRequest {
  senderProfileUid: string;
  receiverProfileRef: string;
  reasonCode?: string;
  notes?: string;
}

@Injectable()
export class InterestsService {
  constructor(
    @Inject(INTEREST_REPOSITORY) private readonly repository: InterestRepository,
    @Inject(DISCOVERY_REPOSITORY) private readonly discovery: DiscoveryRepository,
    @Inject(INTEREST_AGE_MINIMUMS) private readonly ageMinimums: AgeMinimums,
    @Inject(INTEREST_CLOCK) private readonly clock: () => Date,
    @Inject(INTEREST_CONFIG) private readonly config: InterestConfig,
  ) {}

  async send(user: AuthenticatedUser, receiverProfileRef: string): Promise<InterestView> {
    const receiverId = await this.resolveReceiver(user.sub, receiverProfileRef);
    const now = this.clock();
    const outcome = await this.repository.send(
      { senderId: user.sub, receiverId, now },
      ({ lastDeclinedAt, sentToday }) => {
        if (
          lastDeclinedAt &&
          isCooldownActive(lastDeclinedAt, this.config.resendCooldownDays, now)
        ) {
          throw interestCooldown(
            cooldownEndsAt(lastDeclinedAt, this.config.resendCooldownDays),
          );
        }

        assertWithinDailySendLimit(this.config.dailySendLimit, sentToday);
      },
    );

    if (outcome.kind === 'exists') {
      throw interestAlreadyExists();
    }

    return this.view(outcome.interest, 'sent');
  }

  accept(user: AuthenticatedUser, id: string) {
    return this.act(user, id, 'accept');
  }

  decline(user: AuthenticatedUser, id: string) {
    return this.act(user, id, 'decline');
  }

  withdraw(user: AuthenticatedUser, id: string) {
    return this.act(user, id, 'withdraw');
  }

  async list(
    user: AuthenticatedUser,
    direction: InterestDirection,
    query: { status?: InterestStatus; limit?: number; cursor?: string },
  ): Promise<{ items: InterestListItem[]; nextCursor: string | null }> {
    const limit = query.limit ?? DEFAULT_INTEREST_PAGE_SIZE;
    const rows = await this.repository.list({
      userId: user.sub,
      direction,
      status: query.status ?? null,
      after: query.cursor ? decodeInterestCursor(query.cursor) : null,
      fetch: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];

    return {
      items: page.map((row) => ({ ...this.view(row, direction), member: row.member })),
      nextCursor:
        rows.length > limit
          ? encodeInterestCursor({ createdAt: last.cursorAt, id: last.id })
          : null,
    };
  }

  async clearCooldown(
    adminId: string,
    request: ClearCooldownRequest,
    audit: AuditContext,
  ): Promise<{ cleared: true }> {
    const reasonCode = this.validateCooldownReason(request.reasonCode);
    const notes = request.notes?.trim() ?? '';

    if (notes.length > REVIEW_NOTES_MAX) {
      throw this.validation(`notes must be at most ${REVIEW_NOTES_MAX} characters`);
    }

    const cleared = await this.repository.clearCooldown({
      senderProfileUid: request.senderProfileUid,
      receiverProfileRef: request.receiverProfileRef,
      adminId,
      reasonCode,
      notes: notes.length > 0 ? notes : null,
      cooldownDays: this.config.resendCooldownDays,
      audit,
      now: this.clock(),
    });

    if (!cleared) {
      throw cooldownNotFound();
    }

    return { cleared: true };
  }

  private async act(
    user: AuthenticatedUser,
    id: string,
    action: InterestAction,
  ): Promise<InterestView> {
    if (!UUID.test(id)) {
      throw interestNotFound();
    }

    const outcome = await this.repository.transition(
      { interestId: id, actorId: user.sub, action, now: this.clock() },
      (from) => {
        const decision = decideTransition(from, action);

        if (!decision) {
          throw invalidInterestTransition(from);
        }

        return decision;
      },
    );

    if (outcome.kind === 'notFound') {
      throw interestNotFound();
    }

    return this.view(outcome.interest, action === 'withdraw' ? 'sent' : 'received');
  }

  /** One 404 body for malformed, unknown, hidden and non-approved receivers. */
  private async resolveReceiver(callerId: string, profileRef: string): Promise<string> {
    if (!PROFILE_REF.test(profileRef)) {
      throw profileNotFound();
    }

    const ownerId = await this.repository.findUserIdByProfileRef(profileRef);

    if (!ownerId) {
      throw profileNotFound();
    }

    if (ownerId === callerId) {
      throw cannotInterestSelf();
    }

    const visible = await this.discovery.findVisibleProfile(
      callerId,
      this.ageMinimums,
      profileRef,
    );

    if (!visible) {
      throw profileNotFound();
    }

    return visible.viewedUserId;
  }

  private view(record: InterestRecord, direction: InterestDirection): InterestView {
    return {
      id: record.id,
      status: record.status,
      statusLabel:
        direction === 'sent' && record.status === 'declined' ? 'Not accepted' : null,
      canChat: canChat(record.status),
      createdAt: record.createdAt.toISOString(),
      respondedAt: record.respondedAt?.toISOString() ?? null,
    };
  }

  private validateCooldownReason(value: unknown): string {
    if (
      typeof value === 'string' &&
      (COOLDOWN_REASON_CODES as readonly string[]).includes(value)
    ) {
      return value;
    }

    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      'INVALID_REASON_CODE',
      'The reason code is missing or not allowed.',
      { allowed: [...COOLDOWN_REASON_CODES] },
    );
  }

  private validation(issue: string): ApiException {
    return new ApiException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Request validation failed.',
      { issues: [issue] },
    );
  }
}
