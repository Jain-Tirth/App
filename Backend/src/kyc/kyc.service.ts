import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiException } from '../common/api-error';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
  type SignedUrl,
} from '../storage/object-storage';
import { ID_NUMBER_CIPHER, type IdNumberCipher } from './id-number.cipher';
import {
  decideRestart,
  lastFour,
  normalizeIdNumber,
  transitionKycStatus,
  validateDeclaredUpload,
  validateStoredFile,
} from './kyc.domain';
import { KYC_PROVIDER, type KycProvider } from './kyc.provider';
import { KYC_REPOSITORY, type KycRepository } from './kyc.repository';
import {
  KYC_MAX_FILE_BYTES,
  KYC_URL_TTL_SECONDS,
  type KycCase,
  type KycDocumentType,
  type KycMedia,
  type KycPurpose,
  type KycVerificationView,
} from './kyc.types';

export const KYC_CONSENT_GATE = Symbol('KYC_CONSENT_GATE');
export const KYC_CLOCK = Symbol('KYC_CLOCK');

/** What the KYC flow needs to know about consent (story 1). */
export interface KycConsentGate {
  hasValidRequiredConsents(userId: string): Promise<boolean>;
}

export interface UploadRequest {
  purpose: KycPurpose;
  contentType: string;
  sizeBytes: number;
  fileName: string;
  documentType?: KycDocumentType;
  idNumber?: string;
}

export interface UploadTicket {
  mediaId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: Date;
}

@Injectable()
export class KycService {
  constructor(
    @Inject(KYC_REPOSITORY) private readonly repository: KycRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(KYC_PROVIDER) private readonly provider: KycProvider,
    @Inject(ID_NUMBER_CIPHER) private readonly cipher: IdNumberCipher,
    @Inject(KYC_CONSENT_GATE) private readonly consents: KycConsentGate,
    @Inject(KYC_CLOCK) private readonly clock: () => Date,
  ) {}

  async createVerification(
    userId: string,
    language: string,
  ): Promise<KycVerificationView> {
    await this.requireValidConsent(userId);

    const { sessionId } = await this.provider.createSession({ userId, language });
    const created = await this.repository.createCase({
      userId,
      status: transitionKycStatus('notStarted', 'start'),
      providerSessionId: sessionId,
    });

    if (!created) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'VERIFICATION_ALREADY_EXISTS',
        'A verification case already exists for this member.',
      );
    }

    return this.toView(created);
  }

  async getVerification(userId: string): Promise<KycVerificationView> {
    return this.toView(await this.requireCase(userId));
  }

  async requestUpload(userId: string, input: UploadRequest): Promise<UploadTicket> {
    const verification = await this.requireCase(userId);

    transitionKycStatus(verification.status, 'documentAttached');
    validateDeclaredUpload(input.purpose, input.contentType, input.sizeBytes);

    if (input.purpose === 'kycId' && input.documentType && input.idNumber) {
      const idNumber = normalizeIdNumber(input.idNumber);
      await this.repository.setIdDetails(verification.id, {
        documentType: input.documentType,
        idNumberEncrypted: this.cipher.encrypt(idNumber),
        idNumberLast4: lastFour(idNumber),
      });
    }

    const mediaId = randomUUID();
    await this.repository.insertPendingMedia({
      id: mediaId,
      verificationId: verification.id,
      userId,
      purpose: input.purpose,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      storageKey: `kyc/${userId}/${mediaId}`,
    });

    const signed = await this.storage.createUploadUrl({
      key: `kyc/${userId}/${mediaId}`,
      contentType: input.contentType,
      expiresInSeconds: KYC_URL_TTL_SECONDS,
    });

    return {
      mediaId,
      uploadUrl: signed.url,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresAt: signed.expiresAt,
    };
  }

  async completeUpload(
    userId: string,
    mediaId: string,
    checksum: string,
  ): Promise<KycVerificationView> {
    const media = await this.requireMedia(userId, mediaId);
    const verification = await this.requireCase(userId);

    if (media.attachedAt) {
      return this.toView(verification);
    }

    transitionKycStatus(verification.status, 'documentAttached');

    const stored = await this.storage.inspect(
      media.storageKey,
      KYC_MAX_FILE_BYTES + 1,
    );

    if (!stored) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'UPLOAD_NOT_FOUND',
        'No uploaded file was found for this upload.',
      );
    }

    try {
      this.verifyStoredObject(media, stored, checksum);
    } catch (error) {
      await this.storage.remove(media.storageKey);
      await this.repository.deleteMedia(media.id);
      throw error;
    }

    const outcome = await this.repository.attachMedia({
      userId,
      mediaId,
      checksum: checksum.toLowerCase(),
      now: this.clock(),
      decideStatus: (current, attached) =>
        transitionKycStatus(
          current.status,
          attached.length === 2 ? 'allDocumentsAttached' : 'documentAttached',
        ),
    });

    if (outcome.replacedStorageKey) {
      await this.storage.remove(outcome.replacedStorageKey);
    }

    await this.notifyProvider(outcome.verification, media);

    return this.toView(outcome.verification);
  }

  async getMediaReadUrl(userId: string, mediaId: string): Promise<SignedUrl> {
    const media = await this.requireMedia(userId, mediaId);

    if (!media.attachedAt) {
      throw this.mediaNotFound();
    }

    return this.storage.createReadUrl({
      key: media.storageKey,
      expiresInSeconds: KYC_URL_TTL_SECONDS,
    });
  }

  async discardPendingUpload(userId: string, mediaId: string): Promise<void> {
    const media = await this.requireMedia(userId, mediaId);

    if (media.attachedAt) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'MEDIA_ALREADY_ATTACHED',
        'An attached file can only be replaced by a new upload.',
      );
    }

    await this.storage.remove(media.storageKey);
    await this.repository.deleteMedia(media.id);
  }

  async restart(userId: string): Promise<KycVerificationView> {
    await this.requireCase(userId);
    await this.requireValidConsent(userId);

    const outcome = await this.repository.restartCase({
      userId,
      now: this.clock(),
      decide: (current, previousRestarts) => {
        const nextStatus = transitionKycStatus(current.status, 'restart');
        const decision = decideRestart(previousRestarts, this.clock());

        return decision.allowed
          ? { kind: 'proceed', nextStatus }
          : { kind: 'blocked', retryAfterSeconds: decision.retryAfterSeconds };
      },
    });

    if (outcome.kind === 'notFound') {
      throw this.verificationNotFound();
    }

    if (outcome.kind === 'blocked') {
      throw new ApiException(
        HttpStatus.TOO_MANY_REQUESTS,
        'RESTART_LIMIT_REACHED',
        'Verification can be restarted at most 3 times in 24 hours.',
        { retryAfterSeconds: outcome.retryAfterSeconds },
        { 'Retry-After': String(outcome.retryAfterSeconds) },
      );
    }

    await Promise.all(
      outcome.removedStorageKeys.map((key) => this.storage.remove(key)),
    );

    return this.toView(outcome.verification);
  }

  private verifyStoredObject(
    media: KycMedia,
    stored: { sizeBytes: number; sha256Hex: string; head: Buffer },
    checksum: string,
  ): void {
    if (stored.sizeBytes !== media.sizeBytes) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'SIZE_MISMATCH',
        'The uploaded file size differs from the declared size.',
      );
    }

    if (stored.sha256Hex !== checksum.toLowerCase()) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'CHECKSUM_MISMATCH',
        'The uploaded file does not match the provided checksum.',
      );
    }

    validateStoredFile(media.purpose, media.contentType, stored.head);
  }

  private async notifyProvider(
    verification: KycCase,
    media: KycMedia,
  ): Promise<void> {
    if (media.purpose === 'kycPhoto') {
      await this.provider.submitSelfie({
        sessionId: verification.providerSessionId,
        mediaId: media.id,
      });
      return;
    }

    await this.provider.submitDocument({
      sessionId: verification.providerSessionId,
      mediaId: media.id,
      side: 'front',
    });
  }

  private async requireValidConsent(userId: string): Promise<void> {
    if (!(await this.consents.hasValidRequiredConsents(userId))) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'CONSENT_REQUIRED',
        'Valid consent is required before identity verification.',
      );
    }
  }

  private async requireCase(userId: string): Promise<KycCase> {
    const found = await this.repository.findCaseByUser(userId);

    if (!found) {
      throw this.verificationNotFound();
    }

    return found;
  }

  private async requireMedia(userId: string, mediaId: string): Promise<KycMedia> {
    const found = await this.repository.findMedia(userId, mediaId);

    if (!found) {
      throw this.mediaNotFound();
    }

    return found;
  }

  private verificationNotFound(): ApiException {
    return new ApiException(
      HttpStatus.NOT_FOUND,
      'VERIFICATION_NOT_FOUND',
      'No verification case was found.',
    );
  }

  private mediaNotFound(): ApiException {
    return new ApiException(
      HttpStatus.NOT_FOUND,
      'MEDIA_NOT_FOUND',
      'No such file was found.',
    );
  }

  private async toView(verification: KycCase): Promise<KycVerificationView> {
    const media = await this.repository.listAttachedMedia(verification.id);

    return {
      id: verification.id,
      status: verification.status,
      documentType: verification.documentType,
      idNumberLast4: verification.idNumberLast4,
      media: media.flatMap((item) =>
        item.attachedAt
          ? [
              {
                mediaId: item.id,
                purpose: item.purpose,
                contentType: item.contentType,
                sizeBytes: item.sizeBytes,
                attachedAt: item.attachedAt,
              },
            ]
          : [],
      ),
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
    };
  }
}
