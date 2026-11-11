/**
 * Story 1 â€” Versioned consent capture (AC1..AC6).
 *
 * Runs against a booted backend and the disposable test database.
 * AC7 (seeded documents and translations) is asserted directly against the
 * database because it is a migration concern, not an HTTP one.
 */


export const name = 'Story 1 â€” versioned consent capture';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Adds calendar months, matching "exactly 24 months after grantedAt". */
function plusMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/** True when two instants are within a day of each other. */
function sameInstant(a, b) {
  return Math.abs(a.getTime() - b.getTime()) <= DAY_MS;
}

function pass(ac, evidence) {
  return { ac, status: 'PASS', evidence };
}

function fail(ac, evidence) {
  return { ac, status: 'FAIL', evidence };
}

function uniqueSuffix() {
  return String(Date.now()).slice(-7) + Math.floor(Math.random() * 90 + 10);
}

export async function run({ baseUrl, database }) {
  const results = [];

  const api = async (method, path, { token, body } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'user-agent': 'consent-contract-suite/1.0',
        'x-forwarded-for': '203.0.113.7',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let parsed = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // keep raw text
    }
    return { status: response.status, body: parsed, text };
  };

  try {
    const { rows: documents } = await database.query(
      'select code, version, "documentHash" from "ConsentDocuments" where "isActive" = true order by code',
    );

    // ---------------------------------------------------------------- AC7
    const { rows: translationRows } = await database.query(
      `select d.code, t.language, length(t.text) as chars
         from "ConsentDocumentTranslations" t
         join "ConsentDocuments" d on d.id = t."documentId"
        where d."isActive" = true`,
    );
    const languagesByCode = translationRows.reduce((acc, row) => {
      acc[row.code] = acc[row.code] ?? new Set();
      acc[row.code].add(row.language);
      return acc;
    }, {});
    const ac7Ok =
      documents.length === 3 &&
      ['terms', 'privacy', 'id_processing'].every(
        (code) =>
          languagesByCode[code]?.has('en') &&
          languagesByCode[code]?.has('hi') &&
          languagesByCode[code]?.has('gu'),
      ) &&
      documents.every((document) => document.version && document.documentHash);

    results.push(
      ac7Ok
        ? pass(
            'AC7',
            `${documents.length} active documents (${documents
              .map((d) => `${d.code}@${d.version}`)
              .join(', ')}) with en/hi/gu text and hashes`,
          )
        : fail(
            'AC7',
            `documents=${documents.length} languages=${JSON.stringify(
              Object.fromEntries(
                Object.entries(languagesByCode).map(([code, set]) => [
                  code,
                  [...set].join(','),
                ]),
              ),
            )}`,
          ),
    );

    const suffix = uniqueSuffix();
    const email = `ac${suffix}@example.test`;
    const mobileNumber = `9${suffix.padStart(9, '0')}`.slice(0, 10);

    const registrationConsents = documents.map((document) => ({
      code: document.code,
      version: document.version,
      documentHash: document.documentHash,
    }));

    const basePayload = {
      fullName: 'Consent Contract User',
      email,
      password: 'Secret123',
      countryCode: '+91',
      mobileNumber,
      profileCreatedBy: 'myself',
      gender: 'male',
      language: 'en',
    };

    // ---------------------------------------------------------------- AC6 (negative)
    const withoutConsents = await api('POST', '/auth/register', {
      body: basePayload,
    });
    const errorText = JSON.stringify(withoutConsents.body ?? withoutConsents.text);
    const missingCodes = ['terms', 'privacy', 'id_processing'].filter((code) =>
      errorText.includes(code),
    );
    const ac6NegativeOk =
      withoutConsents.status === 400 && missingCodes.length === 3;

    results.push(
      ac6NegativeOk
        ? pass(
            'AC6a',
            `POST /auth/register without consents -> 400 listing ${missingCodes.join(
              ', ',
            )}`,
          )
        : fail(
            'AC6a',
            `expected 400 naming terms, privacy and id_processing; got ${withoutConsents.status}: ${errorText.slice(
              0,
              300,
            )}`,
          ),
    );

    // ---------------------------------------------------------------- AC6 (positive)
    const registered = await api('POST', '/auth/register', {
      body: { ...basePayload, consents: registrationConsents },
    });
    const userId = registered.body?.userId;
    const otpCode = registered.body?.otpCode;
    const otpToken = registered.body?.otpToken;

    const { rows: registrationRecords } = userId
      ? await database.query(
          'select code, "textSnapshot", ip, "userAgent" from "ConsentRecords" where "userId" = $1 order by code',
          [userId],
        )
      : { rows: [] };

    const ac6PositiveOk =
      registered.status === 201 &&
      Boolean(userId) &&
      registrationRecords.length === 3 &&
      registrationRecords.every(
        (record) =>
          typeof record.textSnapshot === 'string' &&
          record.textSnapshot.length > 0,
      );

    results.push(
      ac6PositiveOk
        ? pass(
            'AC6b',
            `register with 3 consents -> 201, userId ${userId}, ${registrationRecords.length} consent records written with text snapshots`,
          )
        : fail(
            'AC6b',
            `status=${registered.status} userId=${userId} records=${registrationRecords.length}`,
          ),
    );

    const verified = await api('POST', '/auth/otp/verify', {
      body: { countryCode: '+91', mobileNumber, otpCode, otpToken },
    });
    const token =
      verified.body?.accessToken ?? verified.body?.tokens?.accessToken;

    if (!token) {
      results.push(
        fail('AC1', `could not obtain a token: ${JSON.stringify(verified.body).slice(0, 300)}`),
        fail('AC2', 'blocked: no token'),
        fail('AC3', 'blocked: no token'),
        fail('AC4', 'blocked: no token'),
        fail('AC5', 'blocked: no token'),
      );
      return results;
    }

    // ---------------------------------------------------------------- AC1
    const currentHindi = await api('GET', '/consents/current?language=hi', {
      token,
    });
    const currentGujarati = await api('GET', '/consents/current?language=gu', {
      token,
    });
    const hindiConsents = currentHindi.body?.consents ?? [];
    const gujaratiConsents = currentGujarati.body?.consents ?? [];
    const hindiTerms = hindiConsents.find((item) => item.code === 'terms');
    const gujaratiTerms = gujaratiConsents.find((item) => item.code === 'terms');
    const ac1Ok =
      currentHindi.status === 200 &&
      hindiConsents.length === 3 &&
      hindiTerms?.text?.length > 0 &&
      /[\u0900-\u097F]/.test(hindiTerms.text) &&
      gujaratiTerms?.text?.length > 0 &&
      /[\u0A80-\u0AFF]/.test(gujaratiTerms.text) &&
      hindiTerms.version ===
        documents.find((document) => document.code === 'terms')?.version &&
      hindiTerms.hash ===
        documents.find((document) => document.code === 'terms')?.documentHash;

    results.push(
      ac1Ok
        ? pass(
            'AC1',
            `GET /consents/current?language=hi -> 200, ${hindiConsents.length} documents; terms text is Devanagari (${hindiTerms.text.length} chars) and gu is Gujarati (${gujaratiTerms.text.length} chars)`,
          )
        : fail(
            'AC1',
            `status=${currentHindi.status} count=${hindiConsents.length} hi=${hindiTerms?.text?.slice(
              0,
              60,
            )} gu=${gujaratiTerms?.text?.slice(0, 60)}`,
          ),
    );

    // ---------------------------------------------------------------- AC2
    const termsDocument = documents.find((document) => document.code === 'terms');
    const recorded = await api('POST', '/consents', {
      token,
      body: {
        code: termsDocument.code,
        version: termsDocument.version,
        documentHash: termsDocument.documentHash,
        language: 'gu',
      },
    });
    const { rows: recordedRows } = await database.query(
      `select "userName", ip, "userAgent", "grantedAt", "expiresAt", "textSnapshot", language, source
         from "ConsentRecords"
        where "userId" = $1 and code = 'terms'
        order by "grantedAt" desc
        limit 1`,
      [userId],
    );
    const recordedRow = recordedRows[0];
    const expiryDelta = recordedRow
      ? new Date(recordedRow.expiresAt).getTime() -
        new Date(recordedRow.grantedAt).getTime()
      : 0;
    const ac2Ok =
      recorded.status === 201 &&
      Boolean(recordedRow) &&
      recordedRow.userName === 'Consent Contract User' &&
      recordedRow.ip === '203.0.113.7' &&
      recordedRow.userAgent === 'consent-contract-suite/1.0' &&
      recordedRow.language === 'gu' &&
      /[\u0A80-\u0AFF]/.test(recordedRow.textSnapshot) &&
      sameInstant(
        new Date(recordedRow.expiresAt),
        plusMonths(new Date(recordedRow.grantedAt), 24),
      );

    results.push(
      ac2Ok
        ? pass(
            'AC2',
            `POST /consents -> 201; stored userName, ip 203.0.113.7, user-agent, gu text snapshot, expiresAt = grantedAt + 24 months (${Math.round(
              expiryDelta / DAY_MS,
            )} days)`,
          )
        : fail(
            'AC2',
            `status=${recorded.status} row=${JSON.stringify(recordedRow)?.slice(
              0,
              400,
            )}`,
          ),
    );

    // ---------------------------------------------------------------- AC3
    const history = await api('GET', '/consents', { token });
    const historyRecords = history.body?.records ?? [];
    const ordered = historyRecords.every((record, index) => {
      if (index === 0) return true;
      return (
        new Date(historyRecords[index - 1].grantedAt).getTime() >=
        new Date(record.grantedAt).getTime()
      );
    });
    const ac3Ok =
      history.status === 200 &&
      historyRecords.length === 4 &&
      ordered &&
      historyRecords.every((record) => record.code && record.textSnapshot);

    const updateBlocked = await database
      .query(`update "ConsentRecords" set "textSnapshot" = 'tampered' where "userId" = $1`, [userId])
      .then(() => false)
      .catch((error) => /APPEND_ONLY/.test(error.message));
    const deleteBlocked = await database
      .query('delete from "ConsentRecords" where "userId" = $1', [userId])
      .then(() => false)
      .catch((error) => /APPEND_ONLY/.test(error.message));

    results.push(
      ac3Ok && updateBlocked && deleteBlocked
        ? pass(
            'AC3',
            `GET /consents -> 200, ${historyRecords.length} records, newest first; direct UPDATE and DELETE both rejected by the append-only trigger`,
          )
        : fail(
            'AC3',
            `status=${history.status} count=${historyRecords.length} ordered=${ordered} updateBlocked=${updateBlocked} deleteBlocked=${deleteBlocked}`,
          ),
    );

    // ---------------------------------------------------------------- AC4
    const beforeInvalid = historyRecords.length;
    const invalid = await api('POST', '/consents', {
      token,
      body: {
        code: termsDocument.code,
        version: termsDocument.version,
        documentHash: 'deadbeef'.repeat(8),
      },
    });
    const { rows: afterInvalidRows } = await database.query(
      'select count(*)::int as total from "ConsentRecords" where "userId" = $1',
      [userId],
    );
    const ac4Ok =
      invalid.status >= 400 &&
      invalid.status < 500 &&
      afterInvalidRows[0].total === beforeInvalid;

    results.push(
      ac4Ok
        ? pass(
            'AC4',
            `POST /consents with a wrong hash -> ${invalid.status}; record count unchanged at ${afterInvalidRows[0].total}`,
          )
        : fail(
            'AC4',
            `status=${invalid.status} before=${beforeInvalid} after=${afterInvalidRows[0].total}`,
          ),
    );

    // ---------------------------------------------------------------- AC5
    // Back-date the privacy record to simulate the 24-month cycle elapsing.
    // The append-only trigger blocks UPDATE by design, so it is disabled for
    // this one fixture write and immediately re-enabled.
    await database.query(
      'alter table "ConsentRecords" disable trigger trg_consent_records_append_only',
    );
    try {
      await database.query(
        `update "ConsentRecords"
            set "expiresAt" = now() - interval '1 day'
          where "userId" = $1 and code = 'privacy'`,
        [userId],
      );
    } finally {
      await database.query(
        'alter table "ConsentRecords" enable trigger trg_consent_records_append_only',
      );
    }

    const currentAfterExpiry = await api('GET', '/consents/current?language=en', {
      token,
    });
    const privacyCurrent = (currentAfterExpiry.body?.consents ?? []).find(
      (item) => item.code === 'privacy',
    );

    const privacyDocument = documents.find(
      (document) => document.code === 'privacy',
    );
    const renewed = await api('POST', '/consents/renew', {
      token,
      body: {
        code: privacyDocument.code,
        version: privacyDocument.version,
        documentHash: privacyDocument.documentHash,
      },
    });
    const { rows: privacyRows } = await database.query(
      `select "grantedAt", "expiresAt"
         from "ConsentRecords"
        where "userId" = $1 and code = 'privacy'
        order by "grantedAt" desc`,
      [userId],
    );
    const newest = privacyRows[0];
    const oldest = privacyRows[privacyRows.length - 1];
    const renewedDelta = newest
      ? new Date(newest.expiresAt).getTime() -
        new Date(newest.grantedAt).getTime()
      : 0;
    const ac5Ok =
      privacyCurrent?.expired === true &&
      renewed.status === 201 &&
      privacyRows.length === 2 &&
      new Date(oldest.expiresAt).getTime() < Date.now() &&
      sameInstant(
        new Date(newest.expiresAt),
        plusMonths(new Date(newest.grantedAt), 24),
      );

    results.push(
      ac5Ok
        ? pass(
            'AC5',
            `expired privacy record reported expired=true; POST /consents/renew -> 201; 2 records kept, the old one still expired, the new one valid for ${Math.round(
              renewedDelta / DAY_MS,
            )} days`,
          )
        : fail(
            'AC5',
            `expiredFlag=${privacyCurrent?.expired} renewStatus=${renewed.status} records=${privacyRows.length}`,
          ),
    );

    return results;
  } finally {
  }
}
