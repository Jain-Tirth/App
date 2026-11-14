import { createHash } from 'node:crypto';
import type { ObjectStorage, SignedUrl, StoredObject } from './object-storage';
import { presignS3Url } from './s3-presign';

export interface S3StorageConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  /** Set for S3-compatible stores such as MinIO; path-style addressing. */
  endpoint: string;
}

const HEAD_BYTES = 16;

/** S3-compatible adapter over SigV4 presigned URLs, with no SDK dependency. */
export class S3StorageProvider implements ObjectStorage {
  constructor(
    private readonly config: S3StorageConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<SignedUrl> {
    return this.sign('PUT', input.key, input.expiresInSeconds, {
      'content-type': input.contentType,
    });
  }

  async createReadUrl(input: {
    key: string;
    expiresInSeconds: number;
  }): Promise<SignedUrl> {
    return this.sign('GET', input.key, input.expiresInSeconds, {});
  }

  async inspect(key: string, maxBytes: number): Promise<StoredObject | null> {
    const signed = this.sign('GET', key, 60, {});
    const response = await fetch(signed.url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok || !response.body) {
      throw new Error(`Object storage read failed with status ${response.status}.`);
    }

    const hash = createHash('sha256');
    const head: Buffer[] = [];
    let headLength = 0;
    let sizeBytes = 0;

    for await (const chunk of response.body) {
      const buffer = Buffer.from(chunk);
      hash.update(buffer);
      sizeBytes += buffer.length;

      if (headLength < HEAD_BYTES) {
        head.push(buffer.subarray(0, HEAD_BYTES - headLength));
        headLength += Math.min(buffer.length, HEAD_BYTES - headLength);
      }

      if (sizeBytes > maxBytes) {
        await response.body.cancel();
        break;
      }
    }

    return {
      sizeBytes,
      sha256Hex: hash.digest('hex'),
      head: Buffer.concat(head),
    };
  }

  async remove(key: string): Promise<void> {
    const signed = this.sign('DELETE', key, 60, {});
    const response = await fetch(signed.url, { method: 'DELETE' });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Object storage delete failed with status ${response.status}.`);
    }
  }

  private sign(
    method: 'GET' | 'PUT' | 'DELETE',
    key: string,
    expiresInSeconds: number,
    signedHeaders: Record<string, string>,
  ): SignedUrl {
    const now = this.now();
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    const endpoint = this.config.endpoint ? new URL(this.config.endpoint) : null;
    const url = presignS3Url({
      method,
      protocol: endpoint ? (endpoint.protocol === 'http:' ? 'http' : 'https') : 'https',
      host: endpoint
        ? endpoint.host
        : `${this.config.bucket}.s3.${this.config.region}.amazonaws.com`,
      path: endpoint
        ? `/${this.config.bucket}/${encodedKey}`
        : `/${encodedKey}`,
      region: this.config.region,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      expiresInSeconds,
      now,
      signedHeaders,
    });

    return { url, expiresAt: new Date(now.getTime() + expiresInSeconds * 1000) };
  }
}
