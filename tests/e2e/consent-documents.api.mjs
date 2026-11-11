/**
 * Public consent documents — the pre-registration surface (verdict item 3).
 *
 * Registration is the first consent moment and happens before a member has a
 * token, so a registration client must be able to read the active documents —
 * and, critically, the `version` and `hash` that `POST /auth/register` accepts —
 * without authentication. Everything else on `/consents*` must stay protected.
 *
 * Runs against the booted backend on the disposable test database.
 */
import { createHash } from 'node:crypto';

export const name = 'Public consent documents — pre-registration surface';

const UA = 'consent-documents/1.0';
const FORWARDED_FOR = '198.51.100.77';

const DEVANAGARI = /[\u0900-\u097F]/;
const GUJARATI = /[\u0A80-\u0AFF]/;
const ASCII_ONLY = /^[\x20-\x7E\r\n\t]*$/;

const DOCUMENT_FIELDS = ['code', 'version', 'hash', 'effectiveAt', 'text'];
const MEMBER_ONLY_FIELDS = [
  'accepted',
  'grantedAt',
  'expiresAt',
  'expired',
  'requiresReconsent',
  'userId',
  'userName',
  'ip',
  'userAgent',
  'textSnapshot',
  'source',
  'id',
  'records',
];

const pass = (ac, evidence) => ({ ac, status: 'PASS', evidence });
const fail = (ac, evidence) => ({ ac, status: 'FAIL', evidence });

function tag() {
  return `${String(Date.now()).slice(-6)}${String(
    Math.floor(Math.random() * 100),
  ).padStart(2, '0')}`;
}

function identity(label) {
  const suffix = tag();
  return {
    fullName: `Documents ${label}`,
    email: `documents.${label.toLowerCase()}.${suffix}@example.test`,
    mobileNumber: `8${suffix.padStart(9, '0')}`,
    password: 'Secret123',
    countryCode: '+91',
    profileCreatedBy: 'myself',
    gender: 'female',
  };
}

const clip = (value, max = 80) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text && text.length > max ? `${text.slice(0, max)}…` : text;
};

const scriptOf = (text) =>
  DEVANAGARI.test(text)
    ? 'devanagari'
    : GUJARATI.test(text)
      ? 'gujarati'
      : ASCII_ONLY.test(text)
        ? 'latin'
        : 'other';

export async function run({ baseUrl, database }) {
  const results = [];
  const record = (ac, ok, evidence) => {
    results.push(ok ? pass(ac, evidence) : fail(ac, evidence));
    return ok;
  };

  const request = async (method, path, { token, body, headers = {} } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'user-agent': UA,
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const raw = await response.text();
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }
    return {
      status: response.status,
      body: json,
      raw,
      requestIdHeader: response.headers.get('x-request-id'),
    };
  };

  // The database is the independent source of truth for the seed.
  const { rows: documentRows } = await database.query(
    `select d.code, d.version, d."documentHash", d."effectiveAt", t.language, t.text
       from "ConsentDocuments" d
       join "ConsentDocumentTranslations" t on t."documentId" = d."id"
      where d."isActive" = true`,
  );
  const dbDocuments = new Map();
  for (const row of documentRows) {
    const existing = dbDocuments.get(row.code) ?? {
      code: row.code,
      version: row.version,
      hash: row.documentHash,
      effectiveAt: row.effectiveAt,
      text: {},
    };
    existing.text[row.language] = row.text;
    dbDocuments.set(row.code, existing);
  }
  const dbList = [...dbDocuments.values()].sort((a, b) => a.code.localeCompare(b.code));

  // ───────────────────────────────────────── AC6-documents (public, complete)
  const anonymous = await request('GET', '/consents/documents');
  const anonymousItems = anonymous.body?.documents ?? [];
  {
    const shapeOk =
      anonymousItems.length === 3 &&
      anonymousItems.every(
        (item) =>
          typeof item.code === 'string' &&
          typeof item.version === 'string' &&
          typeof item.hash === 'string' &&
          /^[0-9a-f]{64}$/.test(item.hash) &&
          typeof item.text === 'string' &&
          item.text.length > 0 &&
          !Number.isNaN(new Date(item.effectiveAt).getTime()),
      );
    const codes = anonymousItems.map((item) => item.code).sort();
    const matchesSeed = dbList.every((document) => {
      const served = anonymousItems.find((item) => item.code === document.code);
      return (
        served &&
        served.version === document.version &&
        served.hash === document.hash &&
        new Date(served.effectiveAt).getTime() ===
          new Date(document.effectiveAt).getTime() &&
        served.text === document.text.en
      );
    });
    // The hash is recomputed here, not trusted from the seed.
    const hashRecomputed = anonymousItems.every(
      (item) =>
        createHash('sha256').update(item.text, 'utf8').digest('hex') === item.hash,
    );

    const ok =
      anonymous.status === 200 &&
      anonymous.body?.language === 'en' &&
      shapeOk &&
      JSON.stringify(codes) === JSON.stringify(['id_processing', 'privacy', 'terms']) &&
      matchesSeed &&
      hashRecomputed;
    record(
      'AC6-documents',
      ok,
      ok
        ? `GET /consents/documents with no Authorization header -> 200 {language:"en", documents:[3]}; codes ${codes.join(', ')} all @1.0 with 64-hex hash, ISO effectiveAt and non-empty text byte-equal to the DB en text; sha256(text) recomputed in node equals the served hash`
        : `status=${anonymous.status} language=${anonymous.body?.language} items=${anonymousItems.length} codes=${clip(codes)} shape=${shapeOk} seedMatch=${matchesSeed} hashRecomputed=${hashRecomputed} body=${clip(anonymous.body, 200)}`,
    );
  }

  // ─────────────────────── AC6-documents-register (served hash is accepted)
  {
    const user = identity('fresh');
    // Exactly what the public endpoint served — no hard-coded seed values.
    const consents = anonymousItems.map((item) => ({
      code: item.code,
      version: item.version,
      documentHash: item.hash,
    }));
    const registered = await request('POST', '/auth/register', {
      body: { ...user, language: 'en', consents },
      headers: { 'x-forwarded-for': FORWARDED_FOR },
    });
    const userId = registered.body?.userId;
    const { rows: accounts } = await database.query(
      'select count(*)::int as total from "Users" where lower("email") = lower($1)',
      [user.email],
    );
    const { rows: records } = userId
      ? await database.query(
          `select code, version, "documentHash", source, ip, "userAgent"
             from "ConsentRecords" where "userId" = $1 order by code`,
          [userId],
        )
      : { rows: [] };
    const onePerCode =
      records.length === 3 &&
      JSON.stringify(records.map((row) => row.code).sort()) ===
        JSON.stringify(['id_processing', 'privacy', 'terms']);
    const storedServedValues = records.every((row) => {
      const served = anonymousItems.find((item) => item.code === row.code);
      return (
        served &&
        row.version === served.version &&
        row.documentHash === served.hash &&
        row.source === 'registration'
      );
    });

    const ok =
      anonymous.status === 200 &&
      registered.status === 201 &&
      Boolean(userId) &&
      accounts[0].total === 1 &&
      onePerCode &&
      storedServedValues &&
      records.every((row) => row.ip === FORWARDED_FOR && row.userAgent === UA);
    record(
      'AC6-documents-register',
      ok,
      ok
        ? `registration using only the served {version, documentHash} for all 3 documents -> 201 userId=${userId.slice(0, 8)}…, 1 Users row, exactly 3 ConsentRecords (one per code) whose version/hash equal what /consents/documents served, source=registration, ip=${FORWARDED_FOR}`
        : `register=${registered.status} userId=${Boolean(userId)} accounts=${accounts[0]?.total} records=${records.length} onePerCode=${onePerCode} storedServedValues=${storedServedValues} body=${clip(registered.body, 160)}`,
    );
  }

  // ───────────────────────── AC6-documents-language (hi / gu / en + header)
  {
    const hindi = await request('GET', '/consents/documents?language=hi');
    const gujarati = await request('GET', '/consents/documents?language=gu');
    const english = await request('GET', '/consents/documents?language=en');
    const headerOnly = await request('GET', '/consents/documents', {
      headers: { 'accept-language': 'gu-IN,gu;q=0.9,en;q=0.5' },
    });

    const items = (response) => response.body?.documents ?? [];
    const hindiItems = items(hindi);
    const gujaratiItems = items(gujarati);
    const englishItems = items(english);
    const headerItems = items(headerOnly);

    const hiDevanagari =
      hindi.status === 200 &&
      hindi.body?.language === 'hi' &&
      hindiItems.length === 3 &&
      hindiItems.every((item) => scriptOf(item.text) === 'devanagari') &&
      dbList.every(
        (document) =>
          hindiItems.find((item) => item.code === document.code)?.text ===
          document.text.hi,
      );
    const guGujarati =
      gujarati.status === 200 &&
      gujarati.body?.language === 'gu' &&
      gujaratiItems.length === 3 &&
      gujaratiItems.every((item) => scriptOf(item.text) === 'gujarati') &&
      dbList.every(
        (document) =>
          gujaratiItems.find((item) => item.code === document.code)?.text ===
          document.text.gu,
      );
    const enLatin =
      english.status === 200 &&
      englishItems.length === 3 &&
      englishItems.every((item) => scriptOf(item.text) === 'latin');
    const headerGujarati =
      headerOnly.status === 200 &&
      headerItems.length === 3 &&
      headerItems.every((item) => scriptOf(item.text) === 'gujarati');

    const ok = hiDevanagari && guGujarati && enLatin && headerGujarati;
    record(
      'AC6-documents-language',
      ok,
      ok
        ? `?language=hi -> 200 language=hi, 3 documents all Devanagari and byte-equal to the DB hi text; ?language=gu -> 200 language=gu, 3 documents Gujarati and byte-equal to the DB gu text; ?language=en -> 3 latin; Accept-Language: gu-IN -> 3 Gujarati`
        : `hi=${hindi.status}/${hindi.body?.language}/${hindiItems.map((item) => scriptOf(item.text)).join(',')} gu=${gujarati.status}/${gujarati.body?.language}/${gujaratiItems.map((item) => scriptOf(item.text)).join(',')} en=${english.status}/${englishItems.map((item) => scriptOf(item.text)).join(',')} header=${headerOnly.status}/${headerItems.map((item) => scriptOf(item.text)).join(',')}`,
    );
  }

  // ─────────────────────── AC1-auth (public read only; member routes guarded)
  {
    const probes = [
      ['GET', '/consents/current'],
      ['GET', '/consents'],
      ['POST', '/consents'],
      ['POST', '/consents/renew'],
    ];
    const observed = [];
    for (const [method, path] of probes) {
      const response = await request(method, path, {
        body:
          method === 'POST'
            ? { code: 'terms', version: '1.0', documentHash: 'x' }
            : undefined,
      });
      observed.push({
        path: `${method} ${path}`,
        status: response.status,
        code: response.body?.code,
        requestId: Boolean(response.body?.requestId),
      });
    }
    const publicRead = await request('GET', '/consents/documents');
    const ok =
      observed.every(
        (item) => item.status === 401 && item.code === 'UNAUTHORIZED' && item.requestId,
      ) && publicRead.status === 200;
    record(
      'AC1-auth',
      ok,
      ok
        ? `unauthenticated: ${observed
            .map((item) => `${item.path} -> 401 ${item.code}`)
            .join('; ')} (envelope carries requestId) — while GET /consents/documents -> 200 without a token`
        : `observed ${JSON.stringify(observed)} documents=${publicRead.status}`,
    );
  }

  // ───────────────────────── AC6-documents-no-leak (only the 5 doc fields)
  {
    const exactFields = anonymousItems.every((item) => {
      const keys = Object.keys(item).sort();
      return JSON.stringify(keys) === JSON.stringify([...DOCUMENT_FIELDS].sort());
    });
    const topLevelKeys = Object.keys(anonymous.body ?? {}).sort();
    const noMemberFields = anonymousItems.every((item) =>
      MEMBER_ONLY_FIELDS.every((field) => !(field in item)),
    );
    // The public route must not expose a member's own data, so no record can
    // be read through it even when a token is supplied.
    const withToken = await request('GET', '/consents/documents', {
      token: 'not-a-jwt',
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    const tokenDoesNotChangePayload =
      withToken.status === 200 &&
      JSON.stringify(withToken.body?.documents ?? []) ===
        JSON.stringify(anonymousItems);

    const ok =
      anonymous.status === 200 &&
      anonymousItems.length === 3 &&
      exactFields &&
      noMemberFields &&
      JSON.stringify(topLevelKeys) === JSON.stringify(['documents', 'language']) &&
      tokenDoesNotChangePayload;
    record(
      'AC6-documents-no-leak',
      ok,
      ok
        ? `public payload is exactly {language, documents:[3]} and every item has exactly {${DOCUMENT_FIELDS.join(
            ', ',
          )}} — no member fields (${MEMBER_ONLY_FIELDS.slice(0, 5).join(
            ', ',
          )}, …), no records/history; an Authorization header does not change the payload`
        : `status=${anonymous.status} items=${anonymousItems.length} exactFields=${exactFields} noMemberFields=${noMemberFields} topLevel=${clip(topLevelKeys)} tokenStable=${tokenDoesNotChangePayload} keys=${clip(Object.keys(anonymousItems[0] ?? {}))}`,
    );
  }

  // ──────────────────────────────────────────────── edge cases
  {
    const unsupported = await request('GET', '/consents/documents?language=xx');
    record(
      'EDGE-documents-language-query',
      unsupported.status === 400 && unsupported.body?.code === 'VALIDATION_ERROR',
      `GET /consents/documents?language=xx -> ${unsupported.status} code=${
        unsupported.body?.code ?? 'n/a'
      } (same validated enum as /consents/current)`,
    );

    const empty = await request('GET', '/consents/documents?language=');
    record(
      'EDGE-documents-empty-language',
      empty.status === 400 && empty.body?.code === 'VALIDATION_ERROR',
      `GET /consents/documents?language= (empty) -> ${empty.status} code=${
        empty.body?.code ?? 'n/a'
      }`,
    );

    const unknownPath = await request('GET', '/consents/documents/extra');
    record(
      'EDGE-documents-unknown-path',
      unknownPath.status === 404,
      `GET /consents/documents/extra -> ${unknownPath.status} (no extra public route was mounted)`,
    );

    const writeAttempt = await request('POST', '/consents/documents', {
      body: { code: 'terms', version: '1.0', documentHash: 'x' },
    });
    record(
      'EDGE-documents-write',
      writeAttempt.status === 404 || writeAttempt.status === 405,
      `POST /consents/documents -> ${writeAttempt.status} (the public surface is read-only)`,
    );
  }

  return results;
}
