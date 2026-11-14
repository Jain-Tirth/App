export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface SignedUrl {
  url: string;
  expiresAt: Date;
}

export interface StoredObject {
  sizeBytes: number;
  sha256Hex: string;
  /** The first bytes of the object, enough for magic-byte detection. */
  head: Buffer;
}

/**
 * Private object storage reached through short-lived signed URLs. File bytes
 * travel between the client and storage only; the API never receives them.
 */
export interface ObjectStorage {
  createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<SignedUrl>;
  createReadUrl(input: {
    key: string;
    expiresInSeconds: number;
  }): Promise<SignedUrl>;
  /** Returns null when no object exists at the key. */
  inspect(key: string, maxBytes: number): Promise<StoredObject | null>;
  remove(key: string): Promise<void>;
}
