import type { KycDocumentType, KycPurpose, KycUploadTicket, KycVerification } from '../types';

export type UploadStage = 'requesting' | 'uploading' | 'verifying' | 'attaching' | 'done';

/** Rough progress per stage; the browser gives no byte-level progress for fetch. */
export const STAGE_PROGRESS: Record<UploadStage, number> = {
  requesting: 10,
  uploading: 40,
  verifying: 75,
  attaching: 90,
  done: 100,
};

export interface KycUploadDeps {
  requestUpload(payload: {
    purpose: KycPurpose;
    contentType: string;
    sizeBytes: number;
    fileName: string;
    documentType?: KycDocumentType;
    idNumber?: string;
  }): Promise<KycUploadTicket>;
  putToStorage(url: string, headers: Record<string, string>, body: Blob): Promise<void>;
  sha256Hex(blob: Blob): Promise<string>;
  complete(mediaId: string, checksum: string): Promise<KycVerification>;
  discard(mediaId: string): Promise<void>;
}

export interface KycUploadParams {
  purpose: KycPurpose;
  file: File;
  documentType?: KycDocumentType;
  idNumber?: string;
}

/** Thrown with the ticket's media id so the caller can discard a half-finished upload. */
export class KycUploadFailure extends Error {
  readonly original: unknown;
  readonly mediaId: string | null;

  constructor(original: unknown, mediaId: string | null) {
    super('Upload failed');
    this.name = 'KycUploadFailure';
    this.original = original;
    this.mediaId = mediaId;
  }
}

/**
 * One file: request ticket, PUT the bytes, SHA-256, complete. On any failure
 * after a ticket was issued the upload is discarded best-effort so a retry
 * starts clean, and the original error is rethrown inside KycUploadFailure.
 */
export async function uploadKycFile(
  deps: KycUploadDeps,
  params: KycUploadParams,
  onStage: (stage: UploadStage) => void = () => undefined,
): Promise<KycVerification> {
  let mediaId: string | null = null;
  try {
    onStage('requesting');
    const ticket = await deps.requestUpload({
      purpose: params.purpose,
      contentType: params.file.type,
      sizeBytes: params.file.size,
      fileName: params.file.name,
      ...(params.purpose === 'kycId'
        ? { documentType: params.documentType, idNumber: params.idNumber?.trim() }
        : {}),
    });
    mediaId = ticket.mediaId;

    onStage('uploading');
    await deps.putToStorage(ticket.uploadUrl, ticket.headers, params.file);

    onStage('verifying');
    const checksum = await deps.sha256Hex(params.file);

    onStage('attaching');
    const verification = await deps.complete(ticket.mediaId, checksum);
    onStage('done');
    return verification;
  } catch (cause) {
    if (mediaId) {
      await deps.discard(mediaId).catch(() => undefined);
    }
    throw new KycUploadFailure(cause, mediaId);
  }
}
