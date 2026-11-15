import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApiException } from '../../common/api-error';
import { evaluateAgeGate, type AgeMinimums } from '../../profiles/age-gate';
import { transitionKycStatus } from '../../kyc/kyc.domain';
import { KYC_URL_TTL_SECONDS, type KycStatus } from '../../kyc/kyc.types';
import { transitionProfileStatus } from '../../profiles/profile-status';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../storage/object-storage';
import { validateReasonCode } from './reason-codes';
import {
  REVIEW_CLOCK,
  REVIEW_REPOSITORY,
  type ReviewRepository,
  type ReviewState,
} from './review.repository';
import { readSla } from './sla';
import {
  REVIEW_NOTES_MAX,
  type AuditContext,
  type BusinessHoursConfig,
  type QueueItem,
  type ReviewDecision,
  type ReviewSection,
  type ReviewSubject,
  type ReviewTransition,
} from './review.types';

export const REVIEW_BUSINESS_HOURS = Symbol('REVIEW_BUSINESS_HOURS');
export const REVIEW_AGE_MINIMUMS = Symbol('REVIEW_AGE_MINIMUMS');

export interface DecisionRequest {
  reasonCode?: string;
  notes?: string;
  sections?: ReviewSection[];
}

/** Every decision is a profile event; `reopen` is the only one without a KYC event. */
const EVENT_BY_DECISION = {
  approve: 'approve',
  reject: 'reject',
  requestChanges: 'requestChanges',
  reopen: 'reopen',
} as const;

const MESSAGE_BY_DECISION = {
  approve: 'Profile approved successfully.',
  reject: 'Profile rejected successfully.',
  requestChanges: 'Changes requested successfully.',
  reopen: 'Profile reopened for changes.',
} as const;

@Injectable()
export class AdminReviewService {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly repository: ReviewRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(REVIEW_CLOCK) private readonly clock: () => Date,
    @Inject(REVIEW_BUSINESS_HOURS) private readonly hours: BusinessHoursConfig,
    @Inject(REVIEW_AGE_MINIMUMS) private readonly minimums: AgeMinimums,
  ) {}

  async listQueue(): Promise<{ total: number; profiles: QueueItem[] }> {
    const now = this.clock();
    const rows = await this.repository.listAwaitingReview();
    const profiles = rows
      .slice()
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
      .map((row) => ({
        userId: row.userId,
        profileUid: row.profileUid,
        name: row.name,
        submittedAt: row.submittedAt.toISOString(),
        ...readSla(row.submittedAt, now, this.hours),
      }));

    return { total: profiles.length, profiles };
  }

  async getWorkspace(userId: string) {
    const subject = await this.requireSubmission(userId);
    const photo = subject.photo as NonNullable<ReviewSubject['photo']>;
    const idDocument = subject.idDocument as NonNullable<ReviewSubject['idDocument']>;
    const photoUrl = await this.storage.createReadUrl({
      key: photo.storageKey,
      expiresInSeconds: KYC_URL_TTL_SECONDS,
    });
    const { age, ageCheck } = this.checkAge(subject);

    return {
      userId: subject.userId,
      profileUid: subject.profileUid,
      name: subject.name,
      dateOfBirth: subject.dateOfBirth,
      age,
      ageCheck,
      accountStatus: subject.accountStatus,
      kycStatus: subject.kycStatus,
      submittedAt: subject.submittedAt?.toISOString() ?? null,
      documentType: subject.documentType,
      idNumberMasked: subject.idNumberLast4 ? `****${subject.idNumberLast4}` : null,
      photo: {
        url: photoUrl.url,
        expiresAt: photoUrl.expiresAt.toISOString(),
        contentType: photo.contentType,
      },
      idDocument: {
        href: `/api/v1/admin/profiles/${subject.userId}/id-document`,
        contentType: idDocument.contentType,
      },
    };
  }

  /** Every call that hands out the ID image is audited before the URL is returned. */
  async openIdDocument(userId: string, adminId: string, audit: AuditContext) {
    const subject = await this.requireSubmission(userId);
    const idDocument = subject.idDocument as NonNullable<ReviewSubject['idDocument']>;
    const now = this.clock();

    await this.repository.recordDocumentView({
      adminId,
      targetId: userId,
      audit,
      now,
    });

    const signed = await this.storage.createReadUrl({
      key: idDocument.storageKey,
      expiresInSeconds: KYC_URL_TTL_SECONDS,
    });

    return {
      url: signed.url,
      expiresAt: signed.expiresAt.toISOString(),
      contentType: idDocument.contentType,
    };
  }

  async decide(
    decision: ReviewDecision,
    userId: string,
    adminId: string,
    request: DecisionRequest,
    audit: AuditContext,
  ) {
    const reasonCode = validateReasonCode(decision, request.reasonCode);
    const notes = this.normaliseNotes(decision, request.notes);
    const sections = this.normaliseSections(decision, request.sections);

    const outcome = await this.repository.applyDecision(
      {
        userId,
        adminId,
        decision,
        reasonCode,
        notes,
        sections,
        audit,
        now: this.clock(),
      },
      (state) => this.transitionFor(decision, state),
    );

    if (outcome.kind === 'notFound') {
      throw this.notFound();
    }

    return {
      message: MESSAGE_BY_DECISION[decision],
      userId,
      decision,
      reasonCode,
      statusBefore: outcome.statusBefore,
      statusAfter: outcome.statusAfter,
    };
  }

  /** The member must be pending with both files attached and the case in review. */
  private transitionFor(
    decision: ReviewDecision,
    state: ReviewState,
  ): ReviewTransition {
    const next = transitionProfileStatus(
      state.profileReviewStatus,
      EVENT_BY_DECISION[decision],
      state.accountStatus,
    );

    if (!next.ok || state.accountStatus === 'blocked') {
      throw this.invalidTransition(state);
    }

    const kycStatus = (state.kycStatus ?? 'notStarted') as KycStatus;

    if (decision === 'reopen') {
      // The member may already have restarted verification; the KYC case stays as it is.
      return {
        kycStatus,
        accountStatus: next.accountStatus,
        profileReviewStatus: next.status,
      };
    }

    if (!state.hasPhoto || !state.hasIdDocument) {
      throw this.invalidTransition(state);
    }

    return {
      kycStatus: transitionKycStatus(kycStatus, decision),
      accountStatus: next.accountStatus,
      profileReviewStatus: next.status,
    };
  }

  private invalidTransition(state: ReviewState): ApiException {
    return new ApiException(
      HttpStatus.CONFLICT,
      'INVALID_STATUS_TRANSITION',
      'This profile is not awaiting review.',
      {
        status: state.profileReviewStatus,
        accountStatus: state.accountStatus,
        kycStatus: state.kycStatus,
      },
    );
  }

  private normaliseNotes(
    decision: ReviewDecision,
    value: string | undefined,
  ): string | null {
    const trimmed = value?.trim() ?? '';

    if (trimmed.length > REVIEW_NOTES_MAX) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Request validation failed.',
        { issues: [`notes must be at most ${REVIEW_NOTES_MAX} characters`] },
      );
    }

    if (decision === 'requestChanges' && trimmed.length === 0) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Request validation failed.',
        { issues: ['notes must be 1 to 500 characters'] },
      );
    }

    return trimmed.length > 0 ? trimmed : null;
  }

  private normaliseSections(
    decision: ReviewDecision,
    value: ReviewSection[] | undefined,
  ): ReviewSection[] {
    if (decision !== 'requestChanges') {
      return [];
    }

    if (!value || value.length === 0) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Request validation failed.',
        { issues: ['sections must contain at least one section'] },
      );
    }

    return [...new Set(value)];
  }

  private checkAge(subject: ReviewSubject): {
    age: number | null;
    ageCheck: 'pass' | 'fail';
  } {
    if (!subject.gender || !subject.dateOfBirth) {
      return { age: null, ageCheck: 'fail' };
    }

    const now = this.clock();
    const measured = evaluateAgeGate(subject.gender, subject.dateOfBirth, now, {
      male: 0,
      female: 0,
    });
    const gate = evaluateAgeGate(
      subject.gender,
      subject.dateOfBirth,
      now,
      this.minimums,
    );

    return {
      age: measured.ok ? measured.age : null,
      ageCheck: gate.ok ? 'pass' : 'fail',
    };
  }

  private async requireSubmission(userId: string): Promise<ReviewSubject> {
    const subject = await this.repository.findSubject(userId);

    if (!subject || !subject.photo || !subject.idDocument) {
      throw this.notFound();
    }

    return subject;
  }

  private notFound(): ApiException {
    return new ApiException(
      HttpStatus.NOT_FOUND,
      'NOT_FOUND',
      'No submission was found for this member.',
    );
  }
}
