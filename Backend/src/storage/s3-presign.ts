import { createHash, createHmac } from 'node:crypto';

export interface S3PresignInput {
  method: 'GET' | 'PUT' | 'DELETE';
  protocol: 'http' | 'https';
  /** Host, with port when it is not the protocol default. */
  host: string;
  /** Path beginning with `/`, already URI-encoded per segment. */
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
  now: Date;
  /** Extra headers the caller must send unchanged, e.g. `content-type`. */
  signedHeaders: Record<string, string>;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** AWS Signature Version 4 query-string signing for a single S3 object. */
export function presignS3Url(input: S3PresignInput): string {
  const stamp = input.now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = stamp.slice(0, 8);
  const scope = `${date}/${input.region}/s3/aws4_request`;
  const headers: Record<string, string> = {
    host: input.host,
    ...Object.fromEntries(
      Object.entries(input.signedHeaders).map(([name, value]) => [
        name.toLowerCase(),
        value.trim(),
      ]),
    ),
  };
  const headerNames = Object.keys(headers).sort();
  const signedHeaders = headerNames.join(';');
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${input.accessKeyId}/${scope}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(input.expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((name) => `${encode(name)}=${encode(query[name])}`)
    .join('&');
  const canonicalRequest = [
    input.method,
    input.path,
    canonicalQuery,
    ...headerNames.map((name) => `${name}:${headers[name]}`),
    '',
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    stamp,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const signingKey = hmac(
    hmac(
      hmac(hmac(`AWS4${input.secretAccessKey}`, date), input.region),
      's3',
    ),
    'aws4_request',
  );
  const signature = createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');

  return (
    `${input.protocol}://${input.host}${input.path}` +
    `?${canonicalQuery}&X-Amz-Signature=${signature}`
  );
}
