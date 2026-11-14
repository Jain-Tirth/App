import { createHash } from 'node:crypto';
import { FakeStorageProvider } from './fake-storage.provider';
import { presignS3Url } from './s3-presign';
import { S3StorageProvider } from './s3-storage.provider';

describe('presignS3Url', () => {
  it('matches the AWS documented SigV4 query-string example', () => {
    const url = presignS3Url({
      method: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      expiresInSeconds: 86400,
      now: new Date('2013-05-24T00:00:00.000Z'),
      signedHeaders: {},
      protocol: 'https',
    });

    expect(url).toContain(
      'X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });
});

describe('S3StorageProvider URLs', () => {
  const now = new Date('2026-11-14T10:00:00.000Z');
  const base = {
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'secret',
    region: 'ap-south-1',
    bucket: 'private-docs',
  };

  it('signs a 10 minute upload URL for the AWS virtual-host address', async () => {
    const storage = new S3StorageProvider({ ...base, endpoint: '' }, () => now);

    const signed = await storage.createUploadUrl({
      key: 'kyc/u1/m1',
      contentType: 'image/png',
      expiresInSeconds: 600,
    });

    expect(signed.url).toMatch(
      /^https:\/\/private-docs\.s3\.ap-south-1\.amazonaws\.com\/kyc\/u1\/m1\?/,
    );
    expect(signed.url).toContain('X-Amz-Expires=600');
    expect(signed.url).toContain('X-Amz-SignedHeaders=content-type%3Bhost');
    expect(signed.expiresAt.getTime()).toBe(now.getTime() + 600_000);
  });

  it('uses path-style addressing for an S3-compatible endpoint', async () => {
    const storage = new S3StorageProvider(
      { ...base, endpoint: 'http://localhost:9000' },
      () => now,
    );

    const signed = await storage.createReadUrl({
      key: 'kyc/u1/m1',
      expiresInSeconds: 600,
    });

    expect(signed.url).toMatch(
      /^http:\/\/localhost:9000\/private-docs\/kyc\/u1\/m1\?/,
    );
    expect(signed.url).toContain('X-Amz-SignedHeaders=host&');
  });
});

describe('FakeStorageProvider', () => {
  const now = new Date('2026-11-14T10:00:00.000Z');
  let current = now;
  let storage: FakeStorageProvider;

  beforeEach(() => {
    current = now;
    storage = new FakeStorageProvider(() => current);
  });

  it('issues an upload URL that expires in the requested time', async () => {
    const signed = await storage.createUploadUrl({
      key: 'kyc/a/b',
      contentType: 'image/png',
      expiresInSeconds: 600,
    });

    expect(signed.expiresAt.getTime()).toBe(now.getTime() + 600_000);
  });

  it('accepts bytes through a valid URL and reports them on inspect', async () => {
    const bytes = Buffer.from('hello');
    const signed = await storage.createUploadUrl({
      key: 'k1',
      contentType: 'image/png',
      expiresInSeconds: 600,
    });

    expect(storage.putViaUrl(signed.url, bytes)).toBe(200);

    const stored = await storage.inspect('k1', 1000);
    expect(stored?.sizeBytes).toBe(5);
    expect(stored?.sha256Hex).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    expect(stored?.head.toString()).toBe('hello');
  });

  it('returns null for an object that was never uploaded', async () => {
    expect(await storage.inspect('missing', 1000)).toBeNull();
  });

  it('answers 403 for an expired URL', async () => {
    const signed = await storage.createUploadUrl({
      key: 'k2',
      contentType: 'image/png',
      expiresInSeconds: 600,
    });
    current = new Date(now.getTime() + 601_000);

    expect(storage.putViaUrl(signed.url, Buffer.from('x'))).toBe(403);
    expect(await storage.inspect('k2', 1000)).toBeNull();
  });

  it('answers 403 for an altered URL', async () => {
    const signed = await storage.createUploadUrl({
      key: 'k3',
      contentType: 'image/png',
      expiresInSeconds: 600,
    });
    const tampered = signed.url.replace('k3', 'k4');

    expect(storage.putViaUrl(tampered, Buffer.from('x'))).toBe(403);
  });

  it('serves bytes through a valid read URL and refuses an expired one', async () => {
    const upload = await storage.createUploadUrl({
      key: 'k5',
      contentType: 'image/png',
      expiresInSeconds: 600,
    });
    storage.putViaUrl(upload.url, Buffer.from('data'));
    const read = await storage.createReadUrl({ key: 'k5', expiresInSeconds: 600 });

    expect(storage.getViaUrl(read.url)).toEqual({
      status: 200,
      body: Buffer.from('data'),
    });

    current = new Date(now.getTime() + 601_000);
    expect(storage.getViaUrl(read.url).status).toBe(403);
  });

  it('removes an object', async () => {
    const upload = await storage.createUploadUrl({
      key: 'k6',
      contentType: 'image/png',
      expiresInSeconds: 600,
    });
    storage.putViaUrl(upload.url, Buffer.from('x'));
    await storage.remove('k6');

    expect(await storage.inspect('k6', 1000)).toBeNull();
  });
});
