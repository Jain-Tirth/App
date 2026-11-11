/**
 * Atomic registration — a failed consent insert must leave no account.
 *
 * Verdict item 2: `AuthService.register` used to create the user first and write
 * the consent records afterwards, so a consent failure produced an account with
 * no DPDP evidence that could never be backfilled (a retry hit USER_EXISTS).
 * The fix runs `fn_register_user` and the consent inserts in one transaction.
 *
 * This suite proves the rollback against the real test database by installing a
 * temporary BEFORE INSERT trigger on "ConsentRecords" that raises for one
 * marker user name. The trigger and its function are dropped in a `finally`
 * block, so the database is always left exactly as it was found.
 *
 * Runs against the booted backend on the disposable test database.
 */
export const name = 'Atomic registration — consent failure leaves no account';

const UA = 'consent-atomic/1.0';
const TRIGGER = 'trg_atomic_probe_consent_failure';
const FUNCTION = 'atomic_probe_consent_failure';

const pass = (ac, evidence) => ({ ac, status: 'PASS', evidence });
const fail = (ac, evidence) => ({ ac, status: 'FAIL', evidence });

const clip = (value, max = 120) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text && text.length > max ? `${text.slice(0, max)}…` : text;
};

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

  const countAccounts = async (email) => {
    const { rows } = await database.query(
      'select count(*)::int as total from "Users" where lower("email") = lower($1)',
      [email],
    );
    return rows[0].total;
  };

  const countMarkerRecords = async (markerName) => {
    const { rows } = await database.query(
      'select count(*)::int as total from "ConsentRecords" where "userName" = $1',
      [markerName],
    );
    return rows[0].total;
  };

  // Independent source of truth for the active documents.
  const { rows: documents } = await database.query(
    `select code, version, "documentHash" from "ConsentDocuments"
      where "isActive" = true order by code`,
  );
  const consents = documents.map((document) => ({
    code: document.code,
    version: document.version,
    documentHash: document.documentHash,
  }));

  // The marker name is unique per run. Consent records are append-only (the
  // migration's trigger rejects DELETE), so a previous run's rows cannot be
  // removed; a per-run marker keeps every run independent of earlier ones.
  const suffix = `${String(Date.now()).slice(-6)}${String(
    Math.floor(Math.random() * 100),
  ).padStart(2, '0')}`;
  const markerName = `Atomic Probe ${suffix}`;
  const user = {
    fullName: markerName,
    email: `atomic.probe.${suffix}@example.test`,
    mobileNumber: `9${suffix.padStart(9, '0')}`,
    password: 'Secret123',
    countryCode: '+91',
    profileCreatedBy: 'myself',
    gender: 'male',
    language: 'en',
    consents,
  };

  let failedResponse = null;
  let accountsAfterFailure = null;
  let recordsAfterFailure = null;
  let triggerArmed = null;

  try {
    // ── install the probe: any ConsentRecords insert for the marker name raises
    await database.query(
      `create or replace function ${FUNCTION}() returns trigger
         language plpgsql as $$
       begin
         if new."userName" = '${markerName}' then
           raise exception 'ATOMIC_PROBE_CONSENT_FAILURE';
         end if;
         return new;
       end;
       $$`,
    );
    await database.query(`drop trigger if exists ${TRIGGER} on "ConsentRecords"`);
    await database.query(
      `create trigger ${TRIGGER} before insert on "ConsentRecords"
         for each row execute function ${FUNCTION}()`,
    );
    const { rows: armed } = await database.query(
      `select tgname, tgenabled from pg_trigger where tgname = $1`,
      [TRIGGER],
    );
    triggerArmed = armed[0]?.tgenabled === 'O';

    // ── the registration that must not survive
    failedResponse = await request('POST', '/auth/register', { body: user });
    accountsAfterFailure = await countAccounts(user.email);
    recordsAfterFailure = await countMarkerRecords(markerName);
  } finally {
    // Always remove the probe, even if the registration or an assertion threw.
    await database.query(`drop trigger if exists ${TRIGGER} on "ConsentRecords"`);
    await database.query(`drop function if exists ${FUNCTION}()`);
  }

  // ─────────────────────────────── AC6-atomic-rollback (no account survives)
  {
    const probeRemoved = await database
      .query('select count(*)::int as total from pg_trigger where tgname = $1', [
        TRIGGER,
      ])
      .then((result) => result.rows[0].total === 0)
      .catch(() => false);
    const failedLoudly =
      failedResponse.status >= 500 &&
      failedResponse.body?.code === 'INTERNAL_ERROR' &&
      Boolean(failedResponse.body?.requestId);

    const ok =
      triggerArmed === true &&
      failedLoudly &&
      accountsAfterFailure === 0 &&
      recordsAfterFailure === 0 &&
      probeRemoved;
    record(
      'AC6-atomic-rollback',
      ok,
      ok
        ? `temporary BEFORE INSERT trigger on "ConsentRecords" raises for the marker name (tgenabled=O); POST /auth/register -> ${failedResponse.status} ${failedResponse.body?.code} with requestId; Users rows for the email = 0 and ConsentRecords for the marker = 0, so the user row created by fn_register_user was rolled back together with the failed consent insert; trigger and function dropped afterwards`
        : `triggerArmed=${triggerArmed} register=${failedResponse?.status}/${failedResponse?.body?.code} accounts=${accountsAfterFailure} records=${recordsAfterFailure} probeRemoved=${probeRemoved} body=${clip(failedResponse?.body, 160)}`,
    );
  }

  // ─────────────────────── AC6-atomic-retry (same payload succeeds afterwards)
  {
    const retried = await request('POST', '/auth/register', { body: user });
    const userId = retried.body?.userId;
    const accounts = await countAccounts(user.email);
    const { rows: rows } = userId
      ? await database.query(
          `select code, version, "documentHash", source, language
             from "ConsentRecords" where "userId" = $1 order by code`,
          [userId],
        )
      : { rows: [] };
    const onePerCode =
      rows.length === 3 &&
      JSON.stringify(rows.map((row) => row.code).sort()) ===
        JSON.stringify(['id_processing', 'privacy', 'terms']);
    const matchesActive = rows.every((row) => {
      const document = documents.find((item) => item.code === row.code);
      return (
        document &&
        row.version === document.version &&
        row.documentHash === document.documentHash &&
        row.source === 'registration'
      );
    });

    const ok =
      retried.status === 201 &&
      Boolean(userId) &&
      accounts === 1 &&
      onePerCode &&
      matchesActive;
    record(
      'AC6-atomic-retry',
      ok,
      ok
        ? `with the probe removed, the identical payload -> 201 userId=${userId.slice(
            0,
            8,
          )}…; exactly 1 Users row and 3 ConsentRecords (one per code) with source=registration matching the active document version/hash — a retry is not blocked by a consent-less account`
        : `register=${retried.status} userId=${Boolean(userId)} accounts=${accounts} records=${rows.length} onePerCode=${onePerCode} matchesActive=${matchesActive} body=${clip(retried.body, 160)}`,
    );
  }

  return results;
}
