import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const ID_NUMBER_CIPHER = Symbol('ID_NUMBER_CIPHER');

export interface IdNumberCipher {
  encrypt(plain: string): string;
  decrypt(stored: string): string;
}

const VERSION = 'v1';

/** AES-256-GCM. Stored form: `v1.<iv>.<tag>.<ciphertext>`, all base64. */
export class AesGcmIdNumberCipher implements IdNumberCipher {
  constructor(private readonly key: Buffer) {}

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

    return [VERSION, iv, cipher.getAuthTag(), body]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64')))
      .join('.');
  }

  decrypt(stored: string): string {
    const [version, iv, tag, body] = stored.split('.');

    if (version !== VERSION || !iv || !tag || !body) {
      throw new Error('Unsupported encrypted value format.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(body, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
