/**
 * Phase 1 story 3 - manual KYC upload, black-box over HTTP + real PostgreSQL.
 * STORAGE_PROVIDER=fake: presigned PUT bytes cannot be sent to the server, so
 * the success path of AC2/AC3/AC3b (attach + magic bytes + size/checksum) is
 * covered at jest level only. Here: gating, validation, ownership, masking,
 * restart boundary (stored timestamps), headers, OpenAPI.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'Phase 1 story 3 - manual KYC upload';

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'Backend');
const row = (ac, ok, evidence) => ({ ac, status: ok ? 'PASS' : 'FAIL', evidence });
const FULL_ID = 'ABCDE1234F';

async function call(baseUrl, method, p, { token, body } = {}) {
  const r = await fetch(`${baseUrl}${p}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* raw */
  }
  return { status: r.status, body: json, text, headers: r.headers };
}

async function newMember(baseUrl, database, withConsent = true) {
  const s = String(Date.now()).slice(-7) + Math.floor(Math.random() * 90 + 10);
  const mobileNumber = `9${s.padStart(9, '0')}`.slice(0, 10);
  const { rows: docs } = await database.query(
    'select code, version, "documentHash" from "ConsentDocuments" where "isActive" = true',
  );
  const reg = await call(baseUrl, 'POST', '/auth/register', {
    body: {
      fullName: 'Kyc User',
      email: `kyc${s}@example.test`,
      password: 'Secret123',
      countryCode: '+91',
      mobileNumber,
      profileCreatedBy: 'myself',
      gender: 'male',
      language: 'en',
      consents: docs.map((d) => ({ code: d.code, version: d.version, documentHash: d.documentHash })),
    },
  });
  const ver = await call(baseUrl, 'POST', '/auth/otp/verify', {
    body: { countryCode: '+91', mobileNumber, otpCode: reg.body?.otpCode, otpToken: reg.body?.otpToken },
  });
  const token = ver.body?.accessToken ?? ver.body?.tokens?.accessToken;
  if (!token) throw new Error(`no token: ${reg.text.slice(0, 200)} / ${ver.text.slice(0, 200)}`);
  const userId = reg.body.userId;
  if (!withConsent) {
    // Records are append-only by trigger; test-db superuser bypasses triggers for this fixture only.
    await database.query("set session_replication_role = replica");
    try {
      await database.query('delete from "ConsentRecords" where "userId" = $1', [userId]);
    } finally {
      await database.query("set session_replication_role = origin");
    }
  }
  return { token, userId };
}

export async function run({ baseUrl, database }) {
  const out = [];
  const K = '/kyc/verification';
  const seen = []; // every response text from this story's endpoints

  const track = (r) => {
    seen.push(r.text);
    return r;
  };

  // AC1
  const noTok = await call(baseUrl, 'POST', K);
  out.push(row('AC1-401', noTok.status === 401, `no token -> ${noTok.status}`));

  const noConsent = await newMember(baseUrl, database, false);
  const r403 = await call(baseUrl, 'POST', K, { token: noConsent.token });
  const { rows: c0 } = await database.query('select count(*)::int n from "KycVerifications" where "userId"=$1', [noConsent.userId]);
  out.push(row('AC1-403', r403.status === 403 && !!r403.body?.code && !!r403.body?.requestId && c0[0].n === 0, `no consent -> ${r403.status} ${r403.text.slice(0, 160)}; rows ${c0[0].n}`));

  const m = await newMember(baseUrl, database);
  const created = track(await call(baseUrl, 'POST', K, { token: m.token }));
  out.push(row('AC1', created.status === 201 && created.body?.status === 'consentGiven', `valid consent -> ${created.status} ${created.text.slice(0, 160)}`));
  const dup = await call(baseUrl, 'POST', K, { token: m.token });
  out.push(row('AC1-repeat', dup.status === 409, `second create -> ${dup.status} ${dup.body?.code}`));

  // AC2 unlisted documentType
  const bad = track(
    await call(baseUrl, 'POST', `${K}/uploads`, {
      token: m.token,
      body: { purpose: 'kycId', contentType: 'image/jpeg', sizeBytes: 1000, fileName: 'a.jpg', documentType: 'passport', idNumber: FULL_ID },
    }),
  );
  const { rows: media0 } = await database.query('select count(*)::int n from "KycMedia" where "userId"=$1', [m.userId]);
  out.push(row('AC2-badType', bad.status === 400 && JSON.stringify(bad.body).includes('documentType') && media0[0].n === 0, `passport -> ${bad.status} ${bad.text.slice(0, 200)}; media rows ${media0[0].n}`));

  // AC3 request URL
  const up = track(
    await call(baseUrl, 'POST', `${K}/uploads`, {
      token: m.token,
      body: { purpose: 'kycId', contentType: 'image/jpeg', sizeBytes: 1000, fileName: 'id.jpg', documentType: 'pan', idNumber: FULL_ID },
    }),
  );
  const ttl = up.body?.expiresAt ? (new Date(up.body.expiresAt).getTime() - Date.now()) / 60000 : -1;
  out.push(row('AC3-url', up.status === 201 && !!up.body?.mediaId && !!up.body?.uploadUrl && ttl >= 5 && ttl <= 15, `upload url -> ${up.status}, ttl ${ttl.toFixed(1)} min`));
  out.push(row('AC5-headers', (up.headers.get('cache-control') ?? '') === 'private, no-store' && (created.headers.get('cache-control') ?? '') === 'private, no-store', `Cache-Control: ${up.headers.get('cache-control')}`));

  // AC3 complete for never-uploaded object
  const comp = track(
    await call(baseUrl, 'POST', `${K}/uploads/${up.body?.mediaId}/complete`, { token: m.token, body: { checksum: 'a'.repeat(64) } }),
  );
  const { rows: att } = await database.query('select count(*)::int n from "KycMedia" where "userId"=$1 and "attachedAt" is not null', [m.userId]);
  out.push(row('AC3-notUploaded', comp.status === 400 && comp.body?.code === 'UPLOAD_NOT_FOUND' && att[0].n === 0, `complete w/o upload -> ${comp.status} ${comp.body?.code}; attached ${att[0].n}`));
  const badCs = await call(baseUrl, 'POST', `${K}/uploads/${up.body?.mediaId}/complete`, { token: m.token, body: { checksum: 'zz' } });
  out.push(row('AC3-badChecksumFormat', badCs.status === 400, `non-hex checksum -> ${badCs.status}`));

  // AC3b declared-size / type rejections at request time
  const tooBig = track(await call(baseUrl, 'POST', `${K}/uploads`, { token: m.token, body: { purpose: 'kycPhoto', contentType: 'image/jpeg', sizeBytes: 10485761, fileName: 'p.jpg' } }));
  const pdfPhoto = track(await call(baseUrl, 'POST', `${K}/uploads`, { token: m.token, body: { purpose: 'kycPhoto', contentType: 'application/pdf', sizeBytes: 1000, fileName: 'p.pdf' } }));
  const gif = track(await call(baseUrl, 'POST', `${K}/uploads`, { token: m.token, body: { purpose: 'kycPhoto', contentType: 'image/gif', sizeBytes: 1000, fileName: 'p.gif' } }));
  const exact = track(await call(baseUrl, 'POST', `${K}/uploads`, { token: m.token, body: { purpose: 'kycPhoto', contentType: 'image/jpeg', sizeBytes: 10485760, fileName: 'p.jpg' } }));
  const codes = [tooBig.body?.code, pdfPhoto.body?.code, gif.body?.code];
  out.push(row('AC3b-request', tooBig.status === 400 && pdfPhoto.status === 400 && gif.status === 400 && new Set(codes).size === 3 && exact.status === 201, `10MB+1 ${tooBig.status} ${codes[0]}; pdf-as-photo ${pdfPhoto.status} ${codes[1]}; gif ${gif.status} ${codes[2]}; exactly 10MB ${exact.status}`));

  // AC4 masking
  const view = track(await call(baseUrl, 'GET', K, { token: m.token }));
  const { rows: enc } = await database.query('select "idNumberEncrypted", "idNumberLast4" from "KycVerifications" where "userId"=$1', [m.userId]);
  const { rows: keys } = await database.query('select "storageKey" from "KycMedia" where "userId"=$1', [m.userId]);
  const allText = seen.join('\n');
  out.push(row('AC4-db', enc[0].idNumberEncrypted != null && !enc[0].idNumberEncrypted.includes(FULL_ID) && enc[0].idNumberLast4 === FULL_ID.slice(-4), `db encrypted != plaintext: ${!String(enc[0].idNumberEncrypted).includes(FULL_ID)}, last4 ${enc[0].idNumberLast4}`));
  out.push(row('AC4-responses', !allText.includes(FULL_ID) && keys.every((k) => !allText.includes(k.storageKey)) && !allText.includes('kyc/'), `${seen.length} responses scanned; no full number, no storage key; view ${view.text.slice(0, 160)}`));

  // AC6 other member
  const other = await newMember(baseUrl, database);
  await call(baseUrl, 'POST', K, { token: other.token });
  const x1 = await call(baseUrl, 'POST', `${K}/uploads/${up.body?.mediaId}/complete`, { token: other.token, body: { checksum: 'a'.repeat(64) } });
  const x2 = await call(baseUrl, 'DELETE', `${K}/uploads/${up.body?.mediaId}`, { token: other.token });
  const x3 = await call(baseUrl, 'GET', `${K}/media/${up.body?.mediaId}/url`, { token: other.token });
  out.push(row('AC6-owner', [x1, x2, x3].every((x) => x.status === 404), `other member complete/delete/read -> ${x1.status}/${x2.status}/${x3.status}`));
  const mass = await call(baseUrl, 'POST', K + '/restart', { token: m.token, body: { status: 'approved', userId: other.userId } });
  const massCreate = await call(baseUrl, 'POST', K, { token: other.token, body: { status: 'approved' } });
  const { rows: st } = await database.query('select status from "KycVerifications" where "userId"=$1', [m.userId]);
  out.push(row('AC6-mass', mass.status === 400 && massCreate.status === 400 && st[0].status === 'consentGiven', `unknown fields -> ${mass.status}/${massCreate.status}; status ${st[0].status}`));

  // AC7 restart boundary with stored timestamps
  const r = await newMember(baseUrl, database);
  await call(baseUrl, 'POST', K, { token: r.token });
  const { rows: vid } = await database.query('select id from "KycVerifications" where "userId"=$1', [r.userId]);
  const setStatus = (s) => database.query('update "KycVerifications" set status=$2 where "userId"=$1', [r.userId, s]);
  const codesSeen = [];
  for (let i = 0; i < 3; i++) {
    await setStatus('failed');
    const x = await call(baseUrl, 'POST', K + '/restart', { token: r.token });
    codesSeen.push(x.status);
  }
  await setStatus('failed');
  const fourth = await call(baseUrl, 'POST', K + '/restart', { token: r.token });
  out.push(row('AC7-4th', codesSeen.every((c) => c === 200) && fourth.status === 429 && Number(fourth.headers.get('retry-after')) > 0, `restarts ${codesSeen} then 4th ${fourth.status} Retry-After ${fourth.headers.get('retry-after')} ${fourth.body?.code}`));
  // age all restarts: 23h59m old still blocks, 24h01m old frees
  await database.query(`update "KycRestarts" set "restartedAt" = now() - interval '23 hours 59 minutes' where "verificationId"=$1`, [vid[0].id]);
  await setStatus('failed');
  const still = await call(baseUrl, 'POST', K + '/restart', { token: r.token });
  await database.query(`update "KycRestarts" set "restartedAt" = now() - interval '24 hours 1 minute' where "verificationId"=$1`, [vid[0].id]);
  await setStatus('failed');
  const freed = await call(baseUrl, 'POST', K + '/restart', { token: r.token });
  out.push(row('AC7-boundary', still.status === 429 && freed.status === 200, `restarts 23h59m old -> ${still.status}; 24h01m old -> ${freed.status}`));
  await setStatus('consentGiven');
  const wrongState = await call(baseUrl, 'POST', K + '/restart', { token: r.token });
  out.push(row('AC7-edge-wrongState', wrongState.status >= 400 && wrongState.status < 500 && wrongState.status !== 429, `restart from consentGiven -> ${wrongState.status} ${wrongState.body?.code}`));

  // AC9
  const yaml = await readFile(path.join(BACKEND_DIR, 'openapi.yaml'), 'utf8');
  const need = ['/kyc/verification', '/kyc/verification/uploads', 'UPLOAD_NOT_FOUND', 'SIZE_MISMATCH', 'CHECKSUM_MISMATCH', 'FILE_CONTENT_MISMATCH', 'FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE', 'FILE_TOO_LARGE', 'RESTART_LIMIT_REACHED', '#/components/schemas/ErrorEnvelope'];
  const missing = need.filter((n) => !yaml.includes(n));
  out.push(row('AC9', missing.length === 0, missing.length ? `missing in openapi.yaml: ${missing}` : 'openapi.yaml names all paths, codes, ErrorEnvelope'));

  return out;
}
