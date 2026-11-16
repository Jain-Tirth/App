import type {
  AgeMinimums,
  SearchCriteria,
  SearchFilterName,
} from './discovery.types';

export interface BuiltQuery {
  text: string;
  values: unknown[];
}

const TODAY_UTC = `(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date`;

/**
 * Search filters and the column each one reads. This is the only place a
 * client-supplied name becomes SQL; the value is always a bound parameter.
 */
const FILTER_COLUMNS: Record<SearchFilterName, string> = {
  maritalStatus: 'pp."maritalStatus"',
  religion: 'pr."religion"',
  community: 'pr."caste"',
  state: 'pl."state"',
  city: 'pl."city"',
  diet: 'pp."eatingHabits"',
};

/** The tables the hard filters read. */
const VISIBLE_FROM = `"Users" u
  JOIN "Profiles" p ON p."userId" = u."id"
  JOIN "ProfilePersonal" pp ON pp."profileId" = p."id"`;

/**
 * The hard filters. They decide who may be seen at all and run in the
 * database, never in the client or after the query.
 *
 * Parameters: $1 caller id, $2 male minimum age, $3 female minimum age.
 */
const VISIBLE_WHERE = `u."role" = 'user'
  AND u."profileReviewStatus" = 'approved'
  AND u."accountStatus" = 'active'
  AND u."id" <> $1
  AND u."gender" <> (SELECT c."gender" FROM "Users" c WHERE c."id" = $1)
  AND NOT EXISTS (
    SELECT 1 FROM "HiddenProfiles" h
    WHERE h."userId" = $1 AND h."hiddenId" = u."id"
  )
  AND pp."dateOfBirth" <= (${TODAY_UTC} - (
    CASE u."gender" WHEN 'male' THEN $2::int ELSE $3::int END
  ) * INTERVAL '1 year')`;

export const CARD_JOINS = `LEFT JOIN "ProfileReligious" pr ON pr."profileId" = p."id"
  LEFT JOIN "ProfileLocations" pl ON pl."profileId" = p."id"
  LEFT JOIN "ProfileProfessional" pw ON pw."profileId" = p."id"
  LEFT JOIN LATERAL (
    SELECT ph."id" FROM "ProfilePhotos" ph
    WHERE ph."userId" = u."id"
      AND ph."isPrimary" = true
      AND ph."validationStatus" = 'approved'
      AND ph."photoKind" = 'individual'
    ORDER BY ph."sortOrder", ph."uploadedAt"
    LIMIT 1
  ) photo ON true`;

/** Only these columns ever leave the database for a result card. */
export const CARD_COLUMNS = `p."profileRef" AS "profileRef",
  split_part(btrim(u."name"), ' ', 1) AS "firstName",
  date_part('year', age(${TODAY_UTC}, pp."dateOfBirth"))::int AS "age",
  pl."city" AS "city",
  pr."religion" AS "religion",
  pr."caste" AS "community",
  pw."occupation" AS "profession",
  photo."id"::text AS "photoRef",
  p."idVerified" AS "verified"`;

const POSITION_COLUMN = `to_char(p."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS "createdAt"`;

function minimumValues(callerId: string, ageMinimums: AgeMinimums): unknown[] {
  return [callerId, ageMinimums.male, ageMinimums.female];
}

export function buildSearchQuery(criteria: SearchCriteria): BuiltQuery {
  const values = minimumValues(criteria.callerId, criteria.ageMinimums);
  const conditions: string[] = [VISIBLE_WHERE];

  for (const [name, value] of Object.entries(criteria.filters) as [
    SearchFilterName,
    string,
  ][]) {
    values.push(value);
    conditions.push(
      `lower(${FILTER_COLUMNS[name]}::text) = lower($${values.length})`,
    );
  }

  if (criteria.after) {
    values.push(criteria.after.createdAt, criteria.after.profileRef);
    conditions.push(
      `(p."createdAt", p."profileRef") < ` +
        `($${values.length - 1}::timestamp AT TIME ZONE 'UTC', $${values.length}::text)`,
    );
  }

  values.push(criteria.fetch);

  return {
    text: `SELECT ${CARD_COLUMNS}, ${POSITION_COLUMN}
FROM ${VISIBLE_FROM}
  ${CARD_JOINS}
WHERE ${conditions.join('\n  AND ')}
ORDER BY p."createdAt" DESC, p."profileRef" DESC
LIMIT $${values.length}`,
    values,
  };
}

export function buildDetailQuery(
  callerId: string,
  ageMinimums: AgeMinimums,
  profileRef: string,
): BuiltQuery {
  const values = [...minimumValues(callerId, ageMinimums), profileRef];

  return {
    text: `SELECT u."id" AS "viewedUserId", ${CARD_COLUMNS},
  pp."heightCm" AS "heightCm",
  pp."maritalStatus"::text AS "maritalStatus",
  pp."eatingHabits"::text AS "diet",
  COALESCE(pp."spokenLanguages", ARRAY[]::TEXT[]) AS "spokenLanguages",
  pr."subcaste" AS "subcommunity",
  pl."state" AS "state",
  pl."country" AS "country",
  pw."education" AS "education",
  pw."employmentType"::text AS "employmentType",
  pf."familyStatus" AS "familyStatus",
  pf."aboutMyself" AS "aboutMyself",
  pf."lookingFor" AS "lookingFor"
FROM ${VISIBLE_FROM}
  ${CARD_JOINS}
  LEFT JOIN "ProfileFamilyBio" pf ON pf."profileId" = p."id"
WHERE ${VISIBLE_WHERE}
  AND p."profileRef" = $4`,
    values,
  };
}

/**
 * Fixes today's set for the caller. It inserts only when the caller has no set
 * for the UTC day yet, so a second call returns the same profiles.
 */
export function buildRecommendationInsert(
  callerId: string,
  ageMinimums: AgeMinimums,
  count: number,
): BuiltQuery {
  return {
    text: `INSERT INTO "DailyRecommendations" ("userId", "recommendedId", "date")
SELECT $1::uuid, u."id", ${TODAY_UTC}
FROM ${VISIBLE_FROM}
WHERE ${VISIBLE_WHERE}
  AND NOT EXISTS (
    SELECT 1 FROM "DailyRecommendations" d
    WHERE d."userId" = $1 AND d."date" = ${TODAY_UTC}
  )
ORDER BY random()
LIMIT $4
ON CONFLICT DO NOTHING`,
    values: [...minimumValues(callerId, ageMinimums), count],
  };
}

/**
 * Today's set, re-checked against the hard filters so a profile that was hidden
 * or stopped being approved after the set was fixed no longer appears.
 */
export function buildRecommendationRead(
  callerId: string,
  ageMinimums: AgeMinimums,
): BuiltQuery {
  return {
    text: `SELECT ${CARD_COLUMNS}
FROM ${VISIBLE_FROM}
  JOIN "DailyRecommendations" dr
    ON dr."recommendedId" = u."id" AND dr."userId" = $1 AND dr."date" = ${TODAY_UTC}
  ${CARD_JOINS}
WHERE ${VISIBLE_WHERE}
ORDER BY dr."createdAt", p."profileRef"`,
    values: minimumValues(callerId, ageMinimums),
  };
}
