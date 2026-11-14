import { randomUUID } from 'node:crypto';
import type {
  AttachMediaInput,
  AttachMediaOutcome,
  IdDetails,
  KycRepository,
  NewPendingMedia,
  RestartInput,
  RestartOutcome,
} from './kyc.repository';
import type { KycCase, KycMedia, KycStatus } from './kyc.types';

/**
 * Reference implementation of the repository port, for tests. It follows the
 * same contract as the Postgres adapter, including the decide-under-lock
 * callbacks, so service tests observe the same behaviour.
 */
export class InMemoryKycRepository implements KycRepository {
  readonly cases: KycCase[] = [];
  readonly media: KycMedia[] = [];
  readonly restarts: { verificationId: string; at: Date }[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  async findCaseByUser(userId: string): Promise<KycCase | null> {
    return this.cases.find((item) => item.userId === userId) ?? null;
  }

  async createCase(input: {
    userId: string;
    status: KycStatus;
    providerSessionId: string;
  }): Promise<KycCase | null> {
    if (this.cases.some((item) => item.userId === input.userId)) {
      return null;
    }

    const at = this.now();
    const created: KycCase = {
      id: randomUUID(),
      userId: input.userId,
      status: input.status,
      providerSessionId: input.providerSessionId,
      documentType: null,
      idNumberEncrypted: null,
      idNumberLast4: null,
      createdAt: at,
      updatedAt: at,
    };
    this.cases.push(created);
    return { ...created };
  }

  async setIdDetails(verificationId: string, details: IdDetails): Promise<void> {
    const found = this.cases.find((item) => item.id === verificationId);

    if (found) {
      found.documentType = details.documentType;
      found.idNumberEncrypted = details.idNumberEncrypted;
      found.idNumberLast4 = details.idNumberLast4;
    }
  }

  async insertPendingMedia(input: NewPendingMedia): Promise<KycMedia> {
    const created: KycMedia = {
      ...input,
      checksum: null,
      attachedAt: null,
      createdAt: this.now(),
    };
    this.media.push(created);
    return { ...created };
  }

  async findMedia(userId: string, mediaId: string): Promise<KycMedia | null> {
    const found = this.media.find(
      (item) => item.id === mediaId && item.userId === userId,
    );
    return found ? { ...found } : null;
  }

  async listAttachedMedia(verificationId: string): Promise<KycMedia[]> {
    return this.media
      .filter((item) => item.verificationId === verificationId && item.attachedAt)
      .map((item) => ({ ...item }));
  }

  async deleteMedia(mediaId: string): Promise<void> {
    const index = this.media.findIndex((item) => item.id === mediaId);

    if (index >= 0) {
      this.media.splice(index, 1);
    }
  }

  async attachMedia(input: AttachMediaInput): Promise<AttachMediaOutcome> {
    const target = this.media.find(
      (item) => item.id === input.mediaId && item.userId === input.userId,
    );
    const verification = this.cases.find((item) => item.id === target?.verificationId);

    if (!target || !verification) {
      throw new Error('Media or verification not found.');
    }

    const previous = this.media.find(
      (item) =>
        item.verificationId === target.verificationId &&
        item.purpose === target.purpose &&
        item.attachedAt &&
        item.id !== target.id,
    );
    const attachedPurposes = new Set(
      this.media
        .filter((item) => item.verificationId === target.verificationId && item.attachedAt)
        .map((item) => item.purpose),
    );
    attachedPurposes.add(target.purpose);
    const nextStatus = input.decideStatus(verification, [...attachedPurposes]);

    if (previous) {
      this.media.splice(this.media.indexOf(previous), 1);
    }

    target.checksum = input.checksum;
    target.attachedAt = input.now;
    verification.status = nextStatus;
    verification.updatedAt = input.now;

    return {
      verification: { ...verification },
      replacedStorageKey: previous?.storageKey ?? null,
    };
  }

  async restartCase(input: RestartInput): Promise<RestartOutcome> {
    const verification = this.cases.find((item) => item.userId === input.userId);

    if (!verification) {
      return { kind: 'notFound' };
    }

    const windowStart = input.now.getTime() - 24 * 3600 * 1000;
    const previous = this.restarts
      .filter(
        (item) =>
          item.verificationId === verification.id &&
          item.at.getTime() > windowStart,
      )
      .map((item) => item.at);
    const plan = input.decide(verification, previous);

    if (plan.kind === 'blocked') {
      return plan;
    }

    const removed = this.media.filter((item) => item.verificationId === verification.id);
    for (const item of removed) {
      this.media.splice(this.media.indexOf(item), 1);
    }

    this.restarts.push({ verificationId: verification.id, at: input.now });
    verification.status = plan.nextStatus;
    verification.documentType = null;
    verification.idNumberEncrypted = null;
    verification.idNumberLast4 = null;
    verification.updatedAt = input.now;

    return {
      kind: 'restarted',
      verification: { ...verification },
      removedStorageKeys: removed.map((item) => item.storageKey),
    };
  }
}
