/* Shared fixtures for the UserWeb Playwright specs. Talks to the TEST API (3101) and TEST database only. */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pg = require('../../../Backend/node_modules/pg');

export const API = 'http://127.0.0.1:3101/api/v1';
const DB_URL = process.env.E2E_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5428/dhobi_matrimony_test';
export const ARTIFACTS = path.resolve(__dirname, '..', '..', '..', '.loop', 'artifacts', 'ui-1b');
mkdirSync(ARTIFACTS, { recursive: true });

/** One pooled client for fixtures; Docker-for-Windows port forwarding resets fresh connections now and then, so retry. */
const fixturePool = new pg.Pool({ connectionString: DB_URL, max: 2, connectionTimeoutMillis: 10_000 });

export async function db<T>(fn: (c: any) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    let c: any;
    try {
      c = await fixturePool.connect();
    } catch (err) {
      lastError = err;
      continue;
    }
    try {
      return await fn(c);
    } catch (err: any) {
      if (err?.code === 'ECONNRESET') {
        lastError = err;
        c.release(true);
        c = undefined;
        continue;
      }
      throw err;
    } finally {
      if (c) c.release();
    }
  }
  throw lastError;
}

/** ConsentRecords are append-only by trigger; the test superuser bypasses it for fixtures only. */
export async function dbSuper<T>(fn: (c: any) => Promise<T>): Promise<T> {
  return db(async (c) => {
    await c.query('set session_replication_role = replica');
    try {
      return await fn(c);
    } finally {
      await c.query('set session_replication_role = origin');
    }
  });
}

export async function call(method: string, p: string, o: { token?: string; body?: unknown } = {}) {
  const r = await fetch(`${API}${p}`, {
    method,
    headers: {
      ...(o.body ? { 'content-type': 'application/json' } : {}),
      ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
    },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  const text = await r.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* raw */
  }
  return { status: r.status, body: json, text };
}

export function isoYearsAgo(years: number, extraDays = 0): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() + extraDays);
  return d.toISOString().slice(0, 10);
}
export function isoYearsAhead(years: number): string {
  return isoYearsAgo(-years);
}

let counter = 0;
export function uniq(): string {
  return `${String(Date.now()).slice(-8)}${String(counter++).padStart(2, '0')}${Math.floor(Math.random() * 90 + 10)}`;
}

export interface Member {
  userId: string;
  email: string;
  password: string;
  mobile: string;
  token: string;
  refresh: string;
}

export async function publicDocs() {
  const r = await call('GET', '/consents/documents?language=en');
  return r.body.documents as Array<{ code: string; version: string; hash: string }>;
}

/** Registers (with all 3 consents) and verifies OTP through the API. */
export async function newMember(o: { gender?: 'male' | 'female'; withConsent?: boolean } = {}): Promise<Member> {
  const s = uniq();
  const mobile = `9${s}`.slice(0, 10).padEnd(10, '0');
  const email = `ui1b${s}@example.test`;
  const password = 'Secret123';
  const docs = await publicDocs();
  const reg = await call('POST', '/auth/register', {
    body: {
      fullName: 'Ui Member', email, password, countryCode: '+91', mobileNumber: mobile,
      profileCreatedBy: 'myself', gender: o.gender ?? 'male', language: 'en',
      consents: docs.map((d) => ({ code: d.code, version: d.version, documentHash: d.hash })),
    },
  });
  const ver = await call('POST', '/auth/otp/verify', {
    body: { countryCode: '+91', mobileNumber: mobile, otpCode: reg.body?.otpCode, otpToken: reg.body?.otpToken },
  });
  const token = ver.body?.accessToken ?? ver.body?.tokens?.accessToken;
  const refresh = ver.body?.refreshToken ?? ver.body?.tokens?.refreshToken ?? '';
  if (!token) throw new Error(`newMember failed: ${reg.status} ${reg.text.slice(0, 120)} / ${ver.status} ${ver.text.slice(0, 120)}`);
  const userId = reg.body.userId;
  if (o.withConsent === false) {
    await dbSuper((c) => c.query('delete from "ConsentRecords" where "userId" = $1', [userId]));
  }
  return { userId, email, password, mobile, token, refresh };
}

/** Fills wizard steps 1..5 through the API so the profile counts as complete. */
export async function completeProfile(m: Member, gender: 'male' | 'female' = 'male') {
  const dob = gender === 'male' ? isoYearsAgo(30) : isoYearsAgo(27);
  const steps: Array<[string, unknown]> = [
    ['step-1', { gender, dateOfBirth: dob, heightCm: 170, maritalStatus: 'neverMarried' }],
    ['step-2', { religion: 'Hindu', caste: 'Dhobi / Rajaka', dosh: 'no' }],
    ['step-3', { country: 'India', state: 'Gujarat', city: 'Surat' }],
    ['step-4', { education: 'B.Com', employmentType: 'private', incomeCurrency: 'INR' }],
    ['step-5', { familyStatus: 'Middle Class', aboutMyself: 'About me text', lookingFor: 'Kind partner' }],
  ];
  for (const [step, body] of steps) {
    const r = await call('PUT', `/profiles/${step}`, { token: m.token, body });
    if (r.status >= 300) throw new Error(`${step} -> ${r.status} ${r.text.slice(0, 200)}`);
  }
}

/** Puts a needsReview KYC case with both files attached straight into the test DB. */
export async function seedSubmittedKyc(userId: string) {
  await db(async (c) => {
    const tag = uniq();
    // visiting /kyc auto-creates an empty case; replace it with the submitted one
    await c.query('delete from "KycMedia" where "userId" = $1', [userId]);
    await c.query('delete from "KycVerifications" where "userId" = $1', [userId]);
    const k = await c.query(
      `insert into "KycVerifications"("userId",status,"providerSessionId","documentType","idNumberEncrypted","idNumberLast4")
       values($1,'needsReview',$2,'pan','enc-not-real','234F') returning id`,
      [userId, `sess-${tag}`],
    );
    for (const purpose of ['kycPhoto', 'kycId']) {
      await c.query(
        `insert into "KycMedia"(id,"verificationId","userId",purpose,"contentType","sizeBytes","storageKey",checksum,"attachedAt")
         values($1,$2,$3,$4,'image/jpeg',1000,$5,'ab',now())`,
        [randomUUID(), k.rows[0].id, userId, purpose, `kyc/${userId}/${purpose}-${tag}`],
      );
    }
  });
}

export async function adminToken(): Promise<string> {
  const seed = JSON.parse(readFileSync(path.resolve(ARTIFACTS, '..', 'ui-seed.json'), 'utf8'));
  const r = await call('POST', '/admin/login', { body: { email: seed.email, password: seed.password } });
  const t = r.body?.accessToken;
  if (!t) throw new Error(`admin login failed ${r.status}`);
  return t;
}

export async function adminDecide(
  userId: string,
  action: 'approve' | 'reject' | 'request-changes',
  body: { reasonCode?: string; notes?: string; sections?: string[] } = {},
) {
  const t = await adminToken();
  const r = await call('PATCH', `/admin/profiles/${userId}/${action}`, { token: t, body });
  if (r.status >= 300) throw new Error(`${action} -> ${r.status} ${r.text.slice(0, 200)}`);
  return r.body;
}

/** A member with a complete profile, a submitted KYC case and an admin decision applied. */
export async function memberWithDecision(
  action: 'approve' | 'reject' | 'request-changes',
  body: { reasonCode?: string; notes?: string; sections?: string[] } = {},
) {
  const m = await newMember();
  await completeProfile(m);
  await seedSubmittedKyc(m.userId);
  await adminDecide(m.userId, action, body);
  return m;
}

/** Signs the member in without the UI by seeding the tokens the app reads on boot. */
export async function signIn(page: Page, m: Member) {
  await page.addInitScript(
    ([a, r]) => {
      localStorage.setItem('user_access_token', a);
      localStorage.setItem('user_refresh_token', r);
    },
    [m.token, m.refresh],
  );
}

/** Smallest valid JPEG header bytes (magic bytes FF D8 FF) padded to `size`. */
export function jpegBytes(size = 2048): Buffer {
  const b = Buffer.alloc(size, 0x41);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0;
  b[size - 2] = 0xff; b[size - 1] = 0xd9;
  return b;
}

export const BAD_TEXT = [/[A-Z]{2,}_[A-Z_]+/, /[{}]/, /^Error/];
