import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../apiError';
import { KycUploadFailure, uploadKycFile, type KycUploadDeps, type UploadStage } from './kycUpload';

const verification = {
  id: 'v1',
  status: 'documentUploaded' as const,
  documentType: 'pan' as const,
  idNumberLast4: '1234',
  media: [],
};

function deps(overrides: Partial<KycUploadDeps> = {}): KycUploadDeps {
  return {
    requestUpload: vi.fn(async () => ({
      mediaId: 'm1',
      uploadUrl: 'https://storage.example/put',
      method: 'PUT' as const,
      headers: { 'Content-Type': 'image/png' },
      expiresAt: '2030-01-01T00:00:00Z',
    })),
    putToStorage: vi.fn(async () => undefined),
    sha256Hex: vi.fn(async () => 'a'.repeat(64)),
    complete: vi.fn(async () => verification),
    discard: vi.fn(async () => undefined),
    ...overrides,
  };
}

const file = new File(['abc'], 'id.png', { type: 'image/png' });

describe('uploadKycFile', () => {
  it('runs ticket, PUT, checksum, complete in order and reports each stage', async () => {
    const d = deps();
    const stages: UploadStage[] = [];
    const result = await uploadKycFile(
      d,
      { purpose: 'kycId', file, documentType: 'pan', idNumber: ' ABCDE1234F ' },
      (stage) => stages.push(stage),
    );
    expect(result).toBe(verification);
    expect(stages).toEqual(['requesting', 'uploading', 'verifying', 'attaching', 'done']);
    expect(d.requestUpload).toHaveBeenCalledWith({
      purpose: 'kycId',
      contentType: 'image/png',
      sizeBytes: 3,
      fileName: 'id.png',
      documentType: 'pan',
      idNumber: 'ABCDE1234F',
    });
    expect(d.putToStorage).toHaveBeenCalledWith(
      'https://storage.example/put',
      { 'Content-Type': 'image/png' },
      file,
    );
    expect(d.complete).toHaveBeenCalledWith('m1', 'a'.repeat(64));
  });

  it('sends no id fields for a photo', async () => {
    const d = deps();
    await uploadKycFile(d, { purpose: 'kycPhoto', file });
    expect(d.requestUpload).toHaveBeenCalledWith({
      purpose: 'kycPhoto',
      contentType: 'image/png',
      sizeBytes: 3,
      fileName: 'id.png',
    });
  });

  it('discards the ticket and rethrows the cause when the PUT fails', async () => {
    const cause = new ApiError({ code: 'NETWORK_ERROR', status: 0 });
    const d = deps({ putToStorage: vi.fn(async () => Promise.reject(cause)) });
    const failure = await uploadKycFile(d, { purpose: 'kycPhoto', file }).catch((e) => e);
    expect(failure).toBeInstanceOf(KycUploadFailure);
    expect((failure as KycUploadFailure).original).toBe(cause);
    expect(d.discard).toHaveBeenCalledWith('m1');
    expect(d.complete).not.toHaveBeenCalled();
  });

  it('does not discard when no ticket was issued', async () => {
    const d = deps({ requestUpload: vi.fn(async () => Promise.reject(new Error('x'))) });
    await uploadKycFile(d, { purpose: 'kycPhoto', file }).catch(() => undefined);
    expect(d.discard).not.toHaveBeenCalled();
  });
});
