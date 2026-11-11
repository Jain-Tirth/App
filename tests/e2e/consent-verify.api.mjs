/**
 * Independent verification — Story 1, versioned consent capture (AC1..AC7).
 *
 * Written by the tester. It deliberately shares no helpers with
 * `consent.api.mjs` and re-derives every expectation from the database or
 * from first principles (e.g. it hashes the English text itself instead of
 * trusting the migration's `digest()` call).
 *
 * Runs against the booted backend on the disposable test database.
 */
import { createHash } from 'node:crypto';

export const name = 'Independent verification — versioned consent capture';

const DAY_MS = 24 * 60 * 60 * 1000;
const UA = 'consent-verify/1.0';
const FORWARDED_FOR = '198.51.100.42';

const DEVANAGARI = /[\u0900-\u097F]/;
const GUJARATI = /[\u0A80-\u0AFF]/;
const ASCII_ONLY = /^[\x20-\x7E\r\n\t]*$/;

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
    fullName: `Verify ${label}`,
    email: `verify.${label.toLowerCase()}.${suffix}@example.test`,
    mobileNumber: `7${suffix.padStart(9, '0')}`,
    password: 'Secret123',
    countryCode: '+91',
    profileCreatedBy: 'myself',
    gender: 'male',
  };
}

const clip = (value, max = 60) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text && text.length > max ? `${text.slice(0, max)}…` : text;
};

const scriptOf = (text) =>
  DEVANAGARI.test(text) ? 'devanagari' : GUJARATI.test(text) ? 'gujarati' : ASCII_ONLY.test(text) ? 'latin' : 'other';

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

  const countRecords = async (userId) => {
    const { rows } = await database.query(
      'select count(*)::int as total from "ConsentRecords" where "userId" = $1',
      [userId],
    );
    return rows[0].total;
  };

  const countAccounts = async (email) => {
    const { rows } = await database.query(
      'select count(*)::int as total from "Users" where lower("email") = lower($1)',
      [email],
    );
    return rows[0].total;
  };

  // ─────────────────────────────────────────────── seed / document fixtures
  const { rows: documentRows } = await database.query(
    `select d.code, d.version, d."documentHash", d."effectiveAt", t.language, t.text
       from "ConsentDocuments" d
       join "ConsentDocumentTranslations" t on t."documentId" = d."id"
      where d."isActive" = true`,
  );

  const documents = new Map();
  for (const row of documentRows) {
    const existing = documents.get(row.code) ?? {
      code: row.code,
      version: row.version,
      hash: row.documentHash,
      effectiveAt: row.effectiveAt,
      text: {},
    };
    existing.text[row.language] = row.text;
    documents.set(row.code, existing);
  }
  const documentList = [...documents.values()].sort((a, b) => a.code.localeCompare(b.code));
  const byCode = (code) => documents.get(code);

  // ─────────────────────────────────────────────────────────────── AC7
  {
    const expectedCodes = ['id_processing', 'privacy', 'terms'];
    const codes = documentList.map((document) => document.code).sort();
    const hashChecks = documentList.map((document) => {
      const recomputed = createHash('sha256').update(document.text.en ?? '', 'utf8').digest('hex');
      return {
        code: document.code,
        matches: recomputed === document.hash,
        recomputed,
      };
    });
    const languageChecks = documentList.map((document) => ({
      code: document.code,
      languages: ['en', 'hi', 'gu'].filter((language) => Boolean(document.text[language])),
      scripts: ['hi', 'gu'].map((language) => scriptOf(document.text[language] ?? '')),
    }));
    const ok =
      codes.length === 3 &&
      expectedCodes.every((code) => codes.includes(code)) &&
      documentList.every(
        (document) => document.version === '1.0' && document.hash?.length === 64 && document.effectiveAt,
      ) &&
      hashChecks.every((check) => check.matches) &&
      languageChecks.every(
        (check) =>
          check.languages.length === 3 &&
          check.scripts[0] === 'devanagari' &&
          check.scripts[1] === 'gujarati',
      );

    record(
      'AC7',
      ok,
      ok
        ? `db: ${codes.join(', ')} all @1.0; sha256(en text) recomputed in node equals documentHash for all 3; en/hi/gu present per code (hi=devanagari, gu=gujarati)`
        : `codes=${JSON.stringify(codes)} hashes=${JSON.stringify(hashChecks)} langs=${JSON.stringify(languageChecks)}`,
    );
  }

  // ───────────────────────────────────────────────── AC1 (unauthenticated)
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
        body: method === 'POST' ? { code: 'terms', version: '1.0', documentHash: 'x' } : undefined,
      });
      observed.push({
        path: `${method} ${path}`,
        status: response.status,
        code: response.body?.code,
        requestId: Boolean(response.body?.requestId),
      });
    }
    const ok = observed.every(
      (item) => item.status === 401 && item.code === 'UNAUTHORIZED' && item.requestId,
    );
    record(
      'AC1-auth',
      ok,
      ok
        ? `unauthenticated: ${observed.map((item) => `${item.path} -> 401 ${item.code}`).join('; ')} (envelope carries requestId)`
        : `observed ${JSON.stringify(observed)}`,
    );
  }

  // ─────────────────────────────────────────── register the primary member
  const userA = identity('usera');
  const activeConsents = documentList.map((document) => ({
    code: document.code,
    version: document.version,
    documentHash: document.hash,
  }));

  const registeredA = await request('POST', '/auth/register', {
    body: { ...userA, language: 'hi', consents: activeConsents },
    headers: { 'x-forwarded-for': FORWARDED_FOR },
  });
  const userAId = registeredA.body?.userId;

  const verifiedA = userAId
    ? await request('POST', '/auth/otp/verify', {
        body: {
          countryCode: userA.countryCode,
          mobileNumber: userA.mobileNumber,
          otpCode: registeredA.body?.otpCode,
          otpToken: registeredA.body?.otpToken,
        },
      })
    : { status: 0, body: null };
  const tokenA = verifiedA.body?.tokens?.accessToken ?? null;

  if (!tokenA) {
    results.push(
      fail(
        'AC1',
        `setup blocked: register=${registeredA.status} verify=${verifiedA.status} body=${clip(verifiedA.body, 200)}`,
      ),
      fail('AC2', 'setup blocked: no access token'),
      fail('AC3', 'setup blocked: no access token'),
      fail('AC4', 'setup blocked: no access token'),
      fail('AC5', 'setup blocked: no access token'),
    );
    return results;
  }

  // ─────────────────────────────────────────────────────────────── AC1
  {
    const hindi = await request('GET', '/consents/current?language=hi', { token: tokenA });
    const gujarati = await request('GET', '/consents/current?language=gu', { token: tokenA });
    const english = await request('GET', '/consents/current?language=en', { token: tokenA });
    const headerOnly = await request('GET', '/consents/current', {
      token: tokenA,
      headers: { 'accept-language': 'gu-IN,gu;q=0.9,en;q=0.5' },
    });

    const shapeOk = (response) =>
      (response.body?.consents ?? []).every(
        (item) =>
          typeof item.code === 'string' &&
          typeof item.version === 'string' &&
          typeof item.hash === 'string' &&
          typeof item.text === 'string' &&
          item.text.length > 0 &&
          !Number.isNaN(new Date(item.effectiveAt).getTime()),
      );

    const hindiItems = hindi.body?.consents ?? [];
    const gujaratiItems = gujarati.body?.consents ?? [];
    const englishItems = english.body?.consents ?? [];
    const headerItems = headerOnly.body?.consents ?? [];

    const hindiAllDevanagari =
      hindiItems.length === 3 && hindiItems.every((item) => scriptOf(item.text) === 'devanagari');
    const gujaratiAllGujarati =
      gujaratiItems.length === 3 && gujaratiItems.every((item) => scriptOf(item.text) === 'gujarati');
    // "exact text a member would accept": compare with what registration stored.
    const { rows: registrationSnapshots } = await database.query(
      `select code, language, "textSnapshot" from "ConsentRecords"
        where "userId" = $1 and source = 'registration'`,
      [userAId],
    );
    const snapshotMatches = documentList.every((document) => {
      const served = hindiItems.find((item) => item.code === document.code)?.text;
      const stored = registrationSnapshots.find((row) => row.code === document.code)?.textSnapshot;
      return Boolean(served) && served === stored && served === document.text.hi;
    });
    const englishExact = documentList.every((document) => {
      const served = englishItems.find((item) => item.code === document.code)?.text;
      return served === document.text.en;
    });
    const headerResolvedGujarati =
      headerOnly.status === 200 &&
      headerItems.length === 3 &&
      headerItems.every((item) => scriptOf(item.text) === 'gujarati');

    const ok =
      hindi.status === 200 &&
      gujarati.status === 200 &&
      english.status === 200 &&
      hindiAllDevanagari &&
      gujaratiAllGujarati &&
      englishExact &&
      shapeOk(hindi) &&
      snapshotMatches &&
      headerResolvedGujarati &&
      hindi.body?.language === 'hi';

    record(
      'AC1',
      ok,
      ok
        ? `?language=hi -> 200, 3 docs all devanagari and byte-equal to the registration textSnapshot and to the DB hi text; ?language=gu -> 3 docs gujarati; ?language=en -> byte-equal to DB en text; Accept-Language: gu-IN -> gujarati; effectiveAt/hash/version present`
        : `hi=${hindi.status}/${hindiItems.length}/${hindiItems
            .map((item) => scriptOf(item.text))
            .join(',')} gu=${gujarati.status}/${gujaratiItems.length}/${gujaratiItems
            .map((item) => scriptOf(item.text))
            .join(',')} enExact=${englishExact} snapshotMatch=${snapshotMatches} header=${headerOnly.status}/${headerResolvedGujarati} langEcho=${hindi.body?.language}`,
    );
  }

  // ───────────────────────────────── AC1 fallback when a translation is absent
  {
    const fallbackCode = 'verify_fallback_only_en';
    const englishText = 'Verification-only English consent text used to prove the per-document fallback.';
    const fallbackHash = createHash('sha256').update(englishText, 'utf8').digest('hex');

    await database.query('delete from "ConsentDocuments" where "code" = $1', [fallbackCode]);
    const { rows: inserted } = await database.query(
      `insert into "ConsentDocuments" ("code", "version", "documentHash", "effectiveAt", "isActive")
       values ($1, '1.0', $2, now(), true) returning "id"`,
      [fallbackCode, fallbackHash],
    );
    const fallbackId = inserted[0].id;
    await database.query(
      `insert into "ConsentDocumentTranslations" ("documentId", "language", "text")
       values ($1, 'en', $2)`,
      [fallbackId, englishText],
    );

    let observed = null;
    let cleanupCount = null;
    try {
      const hindi = await request('GET', '/consents/current?language=hi', { token: tokenA });
      const item = (hindi.body?.consents ?? []).find((entry) => entry.code === fallbackCode);
      observed = {
        status: hindi.status,
        total: (hindi.body?.consents ?? []).length,
        text: item?.text,
        script: item ? scriptOf(item.text) : 'missing',
      };
      const ok =
        observed.status === 200 &&
        observed.total === 4 &&
        observed.text === englishText &&
        observed.script === 'latin';
      record(
        'AC1-fallback',
        ok,
        ok
          ? `temporary active document with only en text, requested ?language=hi -> 200 with the English text verbatim (${observed.text.length} chars), so a missing translation falls back to en`
          : `expected verbatim en fallback; got ${JSON.stringify(observed)}`,
      );
    } finally {
      await database.query('delete from "ConsentDocuments" where "code" = $1', [fallbackCode]);
      const { rows } = await database.query(
        'select count(*)::int as total from "ConsentDocuments" where "isActive" = true',
      );
      cleanupCount = rows[0].total;
    }
    if (cleanupCount !== 3) {
      results.push(
        fail('AC1-fallback', `cleanup left ${cleanupCount} active documents (expected 3)`),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────── AC2
  {
    const terms = byCode('terms');
    const before = await countRecords(userAId);
    const response = await request('POST', '/consents', {
      token: tokenA,
      body: { code: terms.code, version: terms.version, documentHash: terms.hash, language: 'hi' },
      headers: { 'x-forwarded-for': FORWARDED_FOR },
    });

    const { rows } = await database.query(
      `select "userId", "userName", code, version, "documentHash", "textSnapshot", language,
              ip, "userAgent", "grantedAt", "expiresAt", source,
              ("expiresAt" = ("grantedAt" + interval '24 months')) as exact_24_months,
              extract(epoch from ("expiresAt" - "grantedAt")) as delta_seconds
         from "ConsentRecords"
        where "userId" = $1 and code = 'terms' and source = 'api'
        order by "grantedAt" desc limit 1`,
      [userAId],
    );
    const row = rows[0];
    const after = await countRecords(userAId);
    const current = await request('GET', '/consents/current?language=hi', { token: tokenA });
    const servedText = (current.body?.consents ?? []).find((item) => item.code === 'terms')?.text;

    const ok =
      response.status === 201 &&
      Boolean(row) &&
      after === before + 1 &&
      row.userId === userAId &&
      row.userName === userA.fullName &&
      row.textSnapshot === terms.text.hi &&
      row.textSnapshot === servedText &&
      row.textSnapshot === response.body?.textSnapshot &&
      row.language === 'hi' &&
      row.ip === FORWARDED_FOR &&
      row.userAgent === UA &&
      row.source === 'api' &&
      row.exact_24_months === true &&
      response.body?.userId === userAId &&
      response.body?.source === 'api';

    record(
      'AC2',
      ok,
      ok
        ? `POST /consents -> 201; db row has userId=${row.userId.slice(0, 8)}…, userName="${row.userName}", hi textSnapshot equal to the served text, ip=${row.ip}, ua=${row.userAgent}, source=${row.source}, grantedAt=${new Date(row.grantedAt).toISOString()}, expiresAt=grantedAt+24 months exactly (${Number(row.delta_seconds)}s), record count ${before}->${after}`
        : `status=${response.status} count=${before}->${after} row=${clip(row)} deltaSeconds=${row?.delta_seconds} exact24=${row?.exact_24_months} snapshotMatchesServed=${row?.textSnapshot === servedText}`,
    );
  }

  // ─────────────────────────────────────────────────────────────── AC3
  {
    // Second member, to prove history is scoped to the caller.
    const userB = identity('userb');
    const registeredB = await request('POST', '/auth/register', {
      body: { ...userB, language: 'en', consents: activeConsents },
    });
    const userBId = registeredB.body?.userId;

    // Double submit: the same consent twice must append twice, not 409 or dedupe.
    const privacy = byCode('privacy');
    const beforeDouble = await countRecords(userAId);
    const first = await request('POST', '/consents', {
      token: tokenA,
      body: { code: privacy.code, version: privacy.version, documentHash: privacy.hash },
    });
    const second = await request('POST', '/consents', {
      token: tokenA,
      body: { code: privacy.code, version: privacy.version, documentHash: privacy.hash },
    });
    const afterDouble = await countRecords(userAId);

    const history = await request('GET', '/consents', { token: tokenA });
    const items = history.body?.records ?? [];
    const ordered = items.every(
      (item, index) =>
        index === 0 ||
        new Date(items[index - 1].grantedAt).getTime() >= new Date(item.grantedAt).getTime(),
    );
    const onlyOwnRecords = items.length > 0 && items.every((item) => item.userId === userAId);
    const dbCount = await countRecords(userAId);
    const totalMatches = history.body?.total === dbCount && items.length === dbCount;

    // Append-only: the trigger itself, its state, and a direct UPDATE/DELETE.
    const { rows: triggerRows } = await database.query(
      `select tgname, tgenabled from pg_trigger where tgname = 'trg_consent_records_append_only'`,
    );
    const { rows: victimRows } = await database.query(
      `select id from "ConsentRecords" where "userId" = $1 order by "grantedAt" asc limit 1`,
      [userBId ?? '00000000-0000-0000-0000-000000000000'],
    );
    const victimId = victimRows[0]?.id;

    let updateError = null;
    let deleteError = null;
    if (victimId) {
      updateError = await database
        .query(`update "ConsentRecords" set "textSnapshot" = 'tampered' where "id" = $1`, [victimId])
        .then((result) => `updated ${result.rowCount} row(s)`)
        .catch((error) => error.message);
      deleteError = await database
        .query('delete from "ConsentRecords" where "id" = $1', [victimId])
        .then((result) => `deleted ${result.rowCount} row(s)`)
        .catch((error) => error.message);
    }
    const updateBlocked = /CONSENT_RECORDS_APPEND_ONLY/.test(updateError ?? '');
    const deleteBlocked = /CONSENT_RECORDS_APPEND_ONLY/.test(deleteError ?? '');
    const triggerEnabled = triggerRows[0]?.tgenabled === 'O';

    // No HTTP endpoint may update or delete a record.
    const recordId = items[0]?.id;
    const deleteRoute = await request('DELETE', `/consents/${recordId}`, { token: tokenA });
    const patchRoute = await request('PATCH', `/consents/${recordId}`, {
      token: tokenA,
      body: { textSnapshot: 'tampered' },
    });
    const putRoute = await request('PUT', '/consents', {
      token: tokenA,
      body: { code: 'terms', version: '1.0', documentHash: 'x' },
    });
    const noMutationRoutes =
      deleteRoute.status === 404 && patchRoute.status === 404 && putRoute.status === 404;

    const ok =
      history.status === 200 &&
      ordered &&
      onlyOwnRecords &&
      totalMatches &&
      first.status === 201 &&
      second.status === 201 &&
      afterDouble === beforeDouble + 2 &&
      triggerEnabled &&
      updateBlocked &&
      deleteBlocked &&
      noMutationRoutes;

    record(
      'AC3',
      ok,
      ok
        ? `GET /consents -> 200, ${items.length} own records (total=${history.body.total}), grantedAt non-increasing, none belong to the other member; double POST appended ${afterDouble - beforeDouble} records; trigger tgenabled=${triggerRows[0].tgenabled}; UPDATE -> "${clip(updateError, 40)}", DELETE -> "${clip(deleteError, 40)}"; DELETE/PATCH /consents/:id and PUT /consents -> 404`
        : `status=${history.status} items=${items.length} total=${history.body?.total} db=${dbCount} ordered=${ordered} own=${onlyOwnRecords} double=${beforeDouble}->${afterDouble} trigger=${JSON.stringify(triggerRows)} update=${clip(updateError, 120)} delete=${clip(deleteError, 120)} routes=${deleteRoute.status}/${patchRoute.status}/${putRoute.status}`,
    );
  }

  // ─────────────────────────────────────────────────────────────── AC4
  {
    const terms = byCode('terms');
    const before = await countRecords(userAId);

    const staleVersion = await request('POST', '/consents', {
      token: tokenA,
      body: { code: terms.code, version: '0.9', documentHash: terms.hash },
    });
    const wrongHash = await request('POST', '/consents', {
      token: tokenA,
      body: { code: terms.code, version: terms.version, documentHash: 'a'.repeat(64) },
    });
    const unknownCode = await request('POST', '/consents', {
      token: tokenA,
      body: { code: 'marketing', version: '1.0', documentHash: terms.hash },
    });
    const after = await countRecords(userAId);
    const { rows: staleRows } = await database.query(
      `select count(*)::int as total from "ConsentRecords" where "userId" = $1 and version = '0.9'`,
      [userAId],
    );

    const envelopeOk = (response) =>
      response.status === 400 &&
      response.body?.code === 'CONSENT_DOCUMENT_MISMATCH' &&
      typeof response.body?.message === 'string' &&
      Boolean(response.body?.requestId) &&
      Boolean(response.requestIdHeader) &&
      response.requestIdHeader === response.body.requestId;

    const ok =
      envelopeOk(staleVersion) &&
      envelopeOk(wrongHash) &&
      envelopeOk(unknownCode) &&
      staleVersion.body?.details?.code === 'terms' &&
      staleVersion.body?.details?.expectedVersion === '1.0' &&
      staleVersion.body?.details?.expectedHash === terms.hash &&
      wrongHash.body?.details?.code === 'terms' &&
      after === before &&
      staleRows[0].total === 0;

    record(
      'AC4',
      ok,
      ok
        ? `stale version -> 400 {code:CONSENT_DOCUMENT_MISMATCH, details:{code:terms, expectedVersion:"1.0", expectedHash:<hash>}, requestId echoed in header}; wrong hash -> 400 same envelope; unknown code -> 400; record count unchanged (${before}) and no version='0.9' row`
        : `stale=${staleVersion.status}/${staleVersion.body?.code}/${clip(staleVersion.body?.details)} wrongHash=${wrongHash.status}/${wrongHash.body?.code} unknown=${unknownCode.status}/${unknownCode.body?.code} count=${before}->${after} staleRows=${staleRows[0].total} header=${staleVersion.requestIdHeader === staleVersion.body?.requestId}`,
    );
  }

  // ─────────────────────────────────────────────────────────────── AC5
  {
    const idProcessing = byCode('id_processing');

    // INSERT is allowed by the append-only trigger, so an already-expired
    // record can be created without disabling the trigger (unlike an UPDATE).
    const { rows: expiredInsert } = await database.query(
      `insert into "ConsentRecords"
         ("userId", "userName", code, version, "documentHash", "textSnapshot", language,
          ip, "userAgent", "grantedAt", "expiresAt", source)
       values ($1, $2, $3, $4, $5, $6, 'en', '198.51.100.42', $7, now(), now() - interval '1 hour', 'api')
       returning "id", "grantedAt", "expiresAt", "textSnapshot", source`,
      [userAId, userA.fullName, idProcessing.code, idProcessing.version, idProcessing.hash, idProcessing.text.en, UA],
    );
    const expiredRow = expiredInsert[0];

    const current = await request('GET', '/consents/current?language=en', { token: tokenA });
    const expiredItem = (current.body?.consents ?? []).find(
      (item) => item.code === 'id_processing',
    );

    const renewed = await request('POST', '/consents/renew', {
      token: tokenA,
      body: {
        code: idProcessing.code,
        version: idProcessing.version,
        documentHash: idProcessing.hash,
        language: 'en',
      },
    });

    const { rows: afterRows } = await database.query(
      `select "id", "grantedAt", "expiresAt", "textSnapshot", source, "updatedAt",
              ("expiresAt" = ("grantedAt" + interval '24 months')) as exact_24_months
         from "ConsentRecords"
        where "userId" = $1 and code = 'id_processing'
        order by "grantedAt" desc, "createdAt" desc, "id" desc`,
      [userAId],
    );
    const newest = afterRows[0];
    const earlier = afterRows.find((row) => row.id === expiredRow.id);
    const freshGrantedAt =
      newest && Math.abs(new Date(newest.grantedAt).getTime() - Date.now()) <= 120_000;

    const earlierUnchanged =
      earlier &&
      earlier.grantedAt.toISOString() === expiredRow.grantedAt.toISOString() &&
      earlier.expiresAt.toISOString() === expiredRow.expiresAt.toISOString() &&
      earlier.textSnapshot === expiredRow.textSnapshot &&
      earlier.source === expiredRow.source;

    const currentAfterRenew = await request('GET', '/consents/current?language=en', {
      token: tokenA,
    });
    const renewedItem = (currentAfterRenew.body?.consents ?? []).find(
      (item) => item.code === 'id_processing',
    );

    const ok =
      current.status === 200 &&
      expiredItem?.expired === true &&
      expiredItem?.accepted === true &&
      expiredItem?.requiresReconsent === true &&
      renewed.status === 201 &&
      newest?.source === 'renewal' &&
      newest?.exact_24_months === true &&
      freshGrantedAt &&
      earlierUnchanged &&
      renewedItem?.expired === false &&
      renewedItem?.requiresReconsent === false &&
      afterRows.length >= 3;

    record(
      'AC5',
      ok,
      ok
        ? `expired record (expiresAt in the past) reported expired=true/requiresReconsent=true; POST /consents/renew -> 201 source=renewal, fresh grantedAt (now±2min), expiresAt=grantedAt+24 months exactly; the earlier row kept identical id/grantedAt/expiresAt/textSnapshot/source; /current afterwards expired=false`
        : `current=${current.status} expiredFlag=${expiredItem?.expired} accepted=${expiredItem?.accepted} reconsent=${expiredItem?.requiresReconsent} renew=${renewed.status} newestSource=${newest?.source} exact24=${newest?.exact_24_months} fresh=${freshGrantedAt} earlierUnchanged=${earlierUnchanged} rows=${afterRows.length}`,
    );
  }

  // ─────────────────────────────────────────────────────────────── AC6
  {
    // (a) nothing submitted
    const noConsents = identity('ac6none');
    const responseA = await request('POST', '/auth/register', { body: noConsents });
    const missingA = responseA.body?.details?.missingConsents ?? [];
    const accountsA = await countAccounts(noConsents.email);
    const okA =
      responseA.status === 400 &&
      responseA.body?.code === 'CONSENT_REQUIRED' &&
      JSON.stringify([...missingA].sort()) ===
        JSON.stringify(['id_processing', 'privacy', 'terms']) &&
      accountsA === 0;
    record(
      'AC6a',
      okA,
      okA
        ? `register without consents -> 400 CONSENT_REQUIRED missingConsents=${JSON.stringify(missingA)}, 0 accounts created`
        : `status=${responseA.status} code=${responseA.body?.code} missing=${JSON.stringify(missingA)} accounts=${accountsA}`,
    );

    // (b) only privacy omitted
    const onlyPrivacy = identity('ac6privacy');
    const termsDoc = byCode('terms');
    const idDoc = byCode('id_processing');
    const privacyDoc = byCode('privacy');
    const responseB = await request('POST', '/auth/register', {
      body: {
        ...onlyPrivacy,
        consents: [
          { code: termsDoc.code, version: termsDoc.version, documentHash: termsDoc.hash },
          { code: idDoc.code, version: idDoc.version, documentHash: idDoc.hash },
        ],
      },
    });
    const missingB = responseB.body?.details?.missingConsents ?? [];
    const accountsB = await countAccounts(onlyPrivacy.email);
    const okB =
      responseB.status === 400 &&
      responseB.body?.code === 'CONSENT_REQUIRED' &&
      JSON.stringify(missingB) === JSON.stringify(['privacy']) &&
      accountsB === 0;
    record(
      'AC6b',
      okB,
      okB
        ? `register with terms+id_processing only -> 400 CONSENT_REQUIRED missingConsents=["privacy"] (terms/id_processing not reported), 0 accounts created`
        : `status=${responseB.status} code=${responseB.body?.code} missing=${JSON.stringify(missingB)} accounts=${accountsB}`,
    );

    // (c) one submitted consent is stale
    const staleUser = identity('ac6stale');
    const responseC = await request('POST', '/auth/register', {
      body: {
        ...staleUser,
        consents: [
          { code: termsDoc.code, version: '0.9', documentHash: termsDoc.hash },
          { code: privacyDoc.code, version: privacyDoc.version, documentHash: privacyDoc.hash },
          { code: idDoc.code, version: idDoc.version, documentHash: idDoc.hash },
        ],
      },
    });
    const missingC = responseC.body?.details?.missingConsents ?? [];
    const accountsC = await countAccounts(staleUser.email);
    const okC =
      responseC.status === 400 &&
      responseC.body?.code === 'CONSENT_REQUIRED' &&
      missingC.includes('terms') &&
      accountsC === 0;
    record(
      'AC6c',
      okC,
      okC
        ? `register with a stale terms@0.9 -> 400 ${responseC.body?.code} missingConsents=${JSON.stringify(missingC)}, 0 accounts created`
        : `status=${responseC.status} code=${responseC.body?.code} missing=${JSON.stringify(missingC)} accounts=${accountsC}`,
    );

    // (d) happy path, with a duplicated code in the payload
    const userC = identity('ac6ok');
    const responseD = await request('POST', '/auth/register', {
      body: {
        ...userC,
        language: 'gu',
        consents: [
          { code: termsDoc.code, version: termsDoc.version, documentHash: termsDoc.hash },
          { code: termsDoc.code, version: termsDoc.version, documentHash: termsDoc.hash },
          { code: privacyDoc.code, version: privacyDoc.version, documentHash: privacyDoc.hash },
          { code: idDoc.code, version: idDoc.version, documentHash: idDoc.hash },
        ],
      },
      headers: { 'x-forwarded-for': FORWARDED_FOR },
    });
    const userCId = responseD.body?.userId;
    const { rows: rowsC } = userCId
      ? await database.query(
          `select code, language, "textSnapshot", ip, "userAgent", source
             from "ConsentRecords" where "userId" = $1 order by code`,
          [userCId],
        )
      : { rows: [] };
    const okD =
      responseD.status === 201 &&
      Boolean(userCId) &&
      rowsC.length === 3 &&
      rowsC.every(
        (row) =>
          row.source === 'registration' &&
          row.language === 'gu' &&
          row.textSnapshot === byCode(row.code)?.text.gu &&
          row.ip === FORWARDED_FOR &&
          row.userAgent === UA,
      );
    record(
      'AC6d',
      okD,
      okD
        ? `register with all 3 (terms duplicated in payload) -> 201, exactly 3 records, one per code, source=registration, language=gu with the gu textSnapshot, ip=${FORWARDED_FOR}`
        : `status=${responseD.status} userId=${Boolean(userCId)} rows=${rowsC.length} ${clip(
            rowsC.map((row) => ({ code: row.code, lang: row.language, source: row.source })),
          )}`,
    );
  }

  // ─────────────────────────────────────── OpenAPI contract conformance
  {
    // Required-field lists copied from Backend/openapi.yaml (components.schemas).
    const CONSENT_RECORD = [
      'id', 'userId', 'userName', 'code', 'version', 'documentHash', 'textSnapshot',
      'language', 'ip', 'userAgent', 'grantedAt', 'expiresAt', 'source',
    ];
    const CURRENT_CONSENT = [
      'code', 'version', 'hash', 'effectiveAt', 'text', 'accepted', 'expired', 'requiresReconsent',
    ];
    const ENVELOPE = ['code', 'message', 'details', 'requestId'];
    const missing = (value, fields) =>
      fields.filter((field) => value == null || !(field in value));

    const history = await request('GET', '/consents', { token: tokenA });
    const current = await request('GET', '/consents/current', { token: tokenA });
    const unauthorized = await request('GET', '/consents/current');
    const posted = await request('POST', '/consents', {
      token: tokenA,
      body: {
        code: byCode('id_processing').code,
        version: byCode('id_processing').version,
        documentHash: byCode('id_processing').hash,
      },
    });

    const gaps = {
      record: missing(posted.body, CONSENT_RECORD),
      historyItem: missing(history.body?.records?.[0], CONSENT_RECORD),
      currentItem: missing(current.body?.consents?.[0], CURRENT_CONSENT),
      historyEnvelope: missing(history.body, ['total', 'records']),
      currentEnvelope: missing(current.body, ['language', 'consents']),
      errorEnvelope: missing(unauthorized.body, ENVELOPE),
    };
    const ok =
      posted.status === 201 &&
      Object.values(gaps).every((list) => list.length === 0);
    record(
      'AC-contract',
      ok,
      ok
        ? `payloads carry every field required by openapi.yaml: ConsentRecord(${CONSENT_RECORD.length}) on POST /consents and on history items, CurrentConsent(${CURRENT_CONSENT.length}), {total,records}, {language,consents}, ErrorEnvelope(${ENVELOPE.join(',')})`
        : `missing required fields: ${JSON.stringify(gaps)}`,
    );
  }

  // ─────────────────────────────────────── edge cases (informational rows)
  {
    const garbage = await request('GET', '/consents/current', {
      token: 'not-a-jwt',
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    record(
      'EDGE-invalid-token',
      garbage.status === 401 && garbage.body?.code === 'UNAUTHORIZED',
      `GET /consents/current with "Bearer not-a-jwt" -> ${garbage.status} code=${garbage.body?.code}`,
    );

    // An explicit query value is a validated instruction: exactly 400.
    // The `Accept-Language` header row below is the documented contrast (a
    // header is a negotiation, so an unsupported value resolves to English).
    const badQuery = await request('GET', '/consents/current?language=xx', { token: tokenA });
    record(
      'EDGE-language',
      badQuery.status === 400 && badQuery.body?.code === 'VALIDATION_ERROR',
      `GET /consents/current?language=xx -> ${badQuery.status} code=${
        badQuery.body?.code ?? 'n/a'
      } (unsupported query value is rejected by the DTO; Accept-Language: xx-YY resolves to en by design — see EDGE-accept-language)`,
    );

    const badHeader = await request('GET', '/consents/current', {
      token: tokenA,
      headers: { 'accept-language': 'xx-YY' },
    });
    const badHeaderItems = badHeader.body?.consents ?? [];
    record(
      'EDGE-accept-language',
      badHeader.status === 200 &&
        badHeaderItems.length === 3 &&
        badHeaderItems.every((item) => scriptOf(item.text) === 'latin'),
      `Accept-Language: xx-YY -> ${badHeader.status}, ${badHeaderItems.length} docs served in English (${badHeaderItems
        .map((item) => scriptOf(item.text))
        .join(',')})`,
    );

    const emptyBody = await request('POST', '/consents', { token: tokenA, body: {} });
    record(
      'EDGE-empty-body',
      emptyBody.status === 400,
      `POST /consents with {} -> ${emptyBody.status} code=${emptyBody.body?.code}, issues=${
        emptyBody.body?.details?.issues?.length ?? 0
      }`,
    );

    const badLanguageBody = await request('POST', '/consents', {
      token: tokenA,
      body: { code: 'terms', version: '1.0', documentHash: 'x', language: 'xx' },
    });
    record(
      'EDGE-body-language',
      badLanguageBody.status === 400,
      `POST /consents with language:"xx" -> ${badLanguageBody.status} code=${badLanguageBody.body?.code}`,
    );

    // Renewal without any prior record for a code must still append (documented
    // assumption 4) and must not touch anything else.
    const userE = identity('renewfirst');
    const registeredE = await request('POST', '/auth/register', {
      body: { ...userE, consents: activeConsents },
    });
    const userEId = registeredE.body?.userId;
    const verifiedE = userEId
      ? await request('POST', '/auth/otp/verify', {
          body: {
            countryCode: userE.countryCode,
            mobileNumber: userE.mobileNumber,
            otpCode: registeredE.body?.otpCode,
            otpToken: registeredE.body?.otpToken,
          },
        })
      : { body: null };
    const tokenE = verifiedE.body?.tokens?.accessToken;
    const renewFirst = tokenE
      ? await request('POST', '/consents/renew', {
          token: tokenE,
          body: {
            code: byCode('terms').code,
            version: byCode('terms').version,
            documentHash: byCode('terms').hash,
          },
        })
      : { status: 0, body: null };
    record(
      'EDGE-renew-without-expiry',
      renewFirst.status === 201 && renewFirst.body?.source === 'renewal',
      `POST /consents/renew for a non-expired consent -> ${renewFirst.status} source=${renewFirst.body?.source} (documented: renewal always appends)`,
    );

    // A stale registration consent list that also contains an unknown code.
    const unknownUser = identity('ac6unknown');
    const responseUnknown = await request('POST', '/auth/register', {
      body: {
        ...unknownUser,
        consents: [
          ...activeConsents,
          { code: 'marketing', version: '1.0', documentHash: 'a'.repeat(64) },
        ],
      },
    });
    const accountsUnknown = await countAccounts(unknownUser.email);
    record(
      'EDGE-unknown-consent-code',
      responseUnknown.status === 400 && accountsUnknown === 0,
      `register with an extra unknown consent code -> ${responseUnknown.status} code=${
        responseUnknown.body?.code
      } details=${clip(responseUnknown.body?.details, 80)}, accounts=${accountsUnknown}`,
    );
  }

  return results;
}
