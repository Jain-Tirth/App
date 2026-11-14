import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ObjectStorage, SignedUrl, StoredObject } from './object-storage';

type Operation = 'put' | 'get';

/**
 * In-memory object store with signed-URL semantics, for tests and local runs.
 * URLs are HMAC-signed and expire; an altered or expired URL answers 403, like
 * the real bucket.
 */
export class FakeStorageProvider implements ObjectStorage {
  private readonly secret = randomBytes(32);
  private readonly objects = new Map<string, Buffer>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<SignedUrl> {
    return this.sign('put', input.key, input.expiresInSeconds);
  }

  async createReadUrl(input: {
    key: string;
    expiresInSeconds: number;
  }): Promise<SignedUrl> {
    return this.sign('get', input.key, input.expiresInSeconds);
  }

  async inspect(key: string): Promise<StoredObject | null> {
    const bytes = this.objects.get(key);

    if (!bytes) {
      return null;
    }

    return {
      sizeBytes: bytes.length,
      sha256Hex: createHash('sha256').update(bytes).digest('hex'),
      head: bytes.subarray(0, 16),
    };
  }

  async remove(key: string): Promise<void> {
    this.objects.delete(key);
  }

  /** Test client: uploads bytes to the object a presigned URL points at. */
  putViaUrl(url: string, bytes: Buffer): number {
    const verified = this.verify(url, 'put');

    if (!verified) {
      return 403;
    }

    this.objects.set(verified, bytes);
    return 200;
  }

  /** Test client: downloads the object a presigned URL points at. */
  getViaUrl(url: string): { status: number; body: Buffer | null } {
    const key = this.verify(url, 'get');
    const bytes = key ? this.objects.get(key) : undefined;

    if (!key) {
      return { status: 403, body: null };
    }

    return bytes ? { status: 200, body: bytes } : { status: 404, body: null };
  }

  private sign(operation: Operation, key: string, ttl: number): SignedUrl {
    const expiresAt = new Date(this.now().getTime() + ttl * 1000);
    const expires = Math.floor(expiresAt.getTime() / 1000);
    const signature = this.signature(operation, key, expires);
    const url =
      `https://fake-storage.invalid/${encodeURIComponent(key)}` +
      `?op=${operation}&expires=${expires}&sig=${signature}`;

    return { url, expiresAt };
  }

  private signature(operation: Operation, key: string, expires: number): string {
    return createHmac('sha256', this.secret)
      .update(`${operation}\n${key}\n${expires}`)
      .digest('hex');
  }

  /** Returns the object key when the URL is genuine and unexpired. */
  private verify(url: string, operation: Operation): string | null {
    const parsed = new URL(url);
    const key = decodeURIComponent(parsed.pathname.slice(1));
    const expires = Number(parsed.searchParams.get('expires'));
    const given = parsed.searchParams.get('sig') ?? '';
    const expected = this.signature(operation, key, expires);
    const sameLength = given.length === expected.length;

    if (
      parsed.searchParams.get('op') !== operation ||
      !sameLength ||
      !timingSafeEqual(Buffer.from(given), Buffer.from(expected)) ||
      expires * 1000 <= this.now().getTime()
    ) {
      return null;
    }

    return key;
  }
}
