/* Fixtures for phase 1 story 6b (member discovery UI). Real test API (3101) and test database only; no source is touched. */
import { randomInt, randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { db, type Member } from '../userweb/support';
import { memberAt } from '../story5b/support5b';

export * from '../story5b/support5b';

export const SENTENCES = {
  invalidCursor: 'Your search results are out of date. Please start the search again.',
  notFound: "This profile isn't available.",
  notApproved:
    'Your profile needs to be approved before you can browse other profiles. You can follow its progress on your status page.',
  recsEmpty: 'No new recommendations today. Try the search below to find more profiles.',
  resultsEmpty: 'No profiles match your search. Try removing a filter.',
};

export interface Seed {
  userId: string;
  profileRef: string;
  profileUid: string;
  email: string;
  mobile: string;
  firstName: string;
  lastName: string;
  photoId: string | null;
}

interface SeedOptions {
  first?: string;
  review?: string;
  account?: string;
  gender?: 'male' | 'female';
  verified?: boolean;
  createdAt?: string;
  city?: string;
  state?: string;
  religion?: string | null;
  community?: string | null;
  subcommunity?: string | null;
  occupation?: string | null;
  education?: string | null;
  employmentType?: string | null;
  marital?: string | null;
  diet?: string | null;
  height?: number | null;
  languages?: string[];
  about?: string | null;
  lookingFor?: string | null;
  familyStatus?: string | null;
  photo?: boolean;
}

/** Inserts one profile straight into the test database (same seam as tests/e2e/discovery-search-detail.api.mjs). */
export async function seedProfile(o: SeedOptions = {}): Promise<Seed> {
  const id = randomUUID();
  const email = `seed6b-${id}@example.test`;
  const mobile = `8${String(randomInt(0, 999999999)).padStart(9, '0')}`;
  const uid = `S${randomInt(100000000, 999999999)}${randomInt(10, 99)}`;
  const firstName = o.first ?? 'Meera';
  const lastName = `Zzlast${randomInt(1000, 9999)}`;
  const has = (k: keyof SeedOptions) => Object.prototype.hasOwnProperty.call(o, k);
  return db(async (c) => {
    await c.query(
      `insert into "Users"(id,name,email,"passwordHash",mobile,role,"accountStatus","profileReviewStatus",gender)
       values($1,$2,$3,'x',$4,'user',$5,$6,$7)`,
      [id, `${firstName} ${lastName}`, email, mobile, o.account ?? 'active', o.review ?? 'approved', o.gender ?? 'female'],
    );
    const pr = await c.query(
      `insert into "Profiles"(id,"userId","profileUid","idVerified","createdAt")
       values(gen_random_uuid(),$1,$2,$3,coalesce($4::timestamptz, now())) returning id,"profileRef"`,
      [id, uid, o.verified ?? false, o.createdAt ?? null],
    );
    const pid = pr.rows[0].id;
    await c.query(
      `insert into "ProfilePersonal"("profileId","dateOfBirth","maritalStatus","eatingHabits","heightCm","spokenLanguages")
       values($1,'1995-05-05',$2,$3,$4,$5)`,
      [pid, o.marital ?? null, o.diet ?? null, has('height') ? o.height : 165, o.languages ?? []],
    );
    await c.query(`insert into "ProfileReligious"("profileId",religion,caste,subcaste) values($1,$2,$3,$4)`, [
      pid,
      has('religion') ? o.religion : 'Jain',
      has('community') ? o.community : 'Dhobi',
      has('subcommunity') ? o.subcommunity : null,
    ]);
    await c.query(`insert into "ProfileLocations"("profileId",country,state,city) values($1,'India',$2,$3)`, [
      pid, o.state ?? 'Gujarat', o.city ?? 'Surat',
    ]);
    await c.query(`insert into "ProfileProfessional"("profileId",occupation,education,"employmentType") values($1,$2,$3,$4)`, [
      pid,
      has('occupation') ? o.occupation : 'Engineer',
      has('education') ? o.education : 'BSc',
      o.employmentType ?? null,
    ]);
    await c.query(
      `insert into "ProfileFamilyBio"("profileId","aboutMyself","lookingFor","familyStatus") values($1,$2,$3,$4)`,
      [pid, has('about') ? o.about : 'About me text', has('lookingFor') ? o.lookingFor : 'Looking text', has('familyStatus') ? o.familyStatus : 'Middle Class'],
    );
    let photoId: string | null = null;
    if (o.photo) {
      const r = await c.query(
        `insert into "ProfilePhotos"("userId","fileUrl","isPrimary","validationStatus","photoKind","sortOrder")
         values($1,$2,true,'approved','individual',0) returning id`,
        [id, `https://fake.invalid/${randomUUID()}.jpg`],
      );
      photoId = r.rows[0].id;
    }
    return { userId: id, profileRef: pr.rows[0].profileRef, profileUid: uid, email, mobile, firstName, lastName, photoId };
  });
}

export interface Dataset {
  tag: string;
  /** 45 approved women in city `tag`, newest first (index 0 is verified and has an approved primary photo). */
  page: Seed[];
  cityRich: string;
  rich: Seed;
  citySparse: string;
  sparse: Seed;
  citySlow: string;
  slow: Seed;
  hidden: Seed;
  nonApproved: Seed;
  unknownRef: string;
  visibleIds: string[];
  all: Seed[];
}

let datasetPromise: Promise<Dataset> | null = null;

/** One seeded data set per worker: enough approved profiles for three pages of 20, plus the special targets. */
export function dataset(): Promise<Dataset> {
  datasetPromise ??= (async () => {
    const tag = `Tq${Date.now().toString(36)}${randomInt(100, 999)}`;
    const base = Date.now() - 3_600_000;
    const page: Seed[] = [];
    for (let i = 0; i < 45; i++) {
      const newest = i === 44;
      page.push(await seedProfile({
        first: newest ? 'Asha' : `Devi${String(i).padStart(2, '0')}`,
        city: tag,
        createdAt: new Date(base + i * 1000).toISOString(),
        verified: newest || i % 2 === 0,
        photo: newest,
      }));
    }
    page.reverse();
    const cityRich = `${tag}r`;
    const rich = await seedProfile({
      first: 'Meera', city: cityRich, state: 'Maharashtra', religion: 'Hindu', community: 'Rajaka', subcommunity: 'Parit',
      occupation: 'Architect', education: 'M.Arch', employmentType: 'private', marital: 'neverMarried', diet: 'vegetarian',
      height: 158, languages: ['Hindi', 'Gujarati'], about: 'I enjoy long walks and old films.', lookingFor: 'A kind and steady partner.',
      familyStatus: 'Upper Middle Class', verified: true,
    });
    const citySparse = `${tag}s`;
    const sparse = await seedProfile({
      first: 'Nila', city: citySparse, religion: null, community: null, occupation: null, education: null, height: null,
      about: null, lookingFor: null, familyStatus: null,
    });
    const citySlow = `${tag}w`;
    const slow = await seedProfile({ first: 'Slowona', city: citySlow });
    const hidden = await seedProfile({ first: 'Hidya', city: `${tag}h` });
    const nonApproved = await seedProfile({ first: 'Pendya', city: `${tag}n`, review: 'submitted', account: 'pending' });
    const visible = [...page, rich, sparse, slow];
    return {
      tag, page, cityRich, rich, citySparse, sparse, citySlow, slow, hidden, nonApproved,
      unknownRef: 'a'.repeat(32),
      visibleIds: visible.map((s) => s.userId),
      all: [...visible, hidden, nonApproved],
    };
  })();
  return datasetPromise;
}

/** Approved member who can see exactly the seeded data set (every other woman in the shared test DB is hidden for him). */
export async function memberWithCandidates(): Promise<{ m: Member; d: Dataset }> {
  const d = await dataset();
  const m = await memberAt('approved');
  await db((c) => c.query(
    `insert into "HiddenProfiles"("userId","hiddenId")
     select $1, id from "Users" where gender='female' and id <> all($2::uuid[]) on conflict do nothing`,
    [m.userId, d.visibleIds],
  ));
  return { m, d };
}

/** Approved member for whom every candidate is hidden: no recommendations and no search results. */
export async function memberWithoutCandidates(): Promise<Member> {
  await dataset();
  const m = await memberAt('approved');
  await db((c) => c.query(
    `insert into "HiddenProfiles"("userId","hiddenId") select $1, id from "Users" where gender='female' on conflict do nothing`,
    [m.userId],
  ));
  return m;
}

/** Stands in for an admin moving the member out of `approved` while his tab is open. */
export async function moveToSubmitted(userId: string) {
  await db((c) => c.query(`update "Users" set "profileReviewStatus"='submitted' where id=$1`, [userId]));
}

export async function ownProfileUid(userId: string): Promise<string | null> {
  return db(async (c) => (await c.query(`select "profileUid" u from "Profiles" where "userId"=$1`, [userId])).rows[0]?.u ?? null);
}

export function ageOf(dob = '1995-05-05'): number {
  const b = new Date(`${dob}T00:00:00Z`);
  const n = new Date();
  let a = n.getUTCFullYear() - b.getUTCFullYear();
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a -= 1;
  return a;
}

/** True when the element's box lies inside the viewport width (reachable without sideways scrolling). */
export async function withinWidth(page: Page, locator: ReturnType<Page['locator']>): Promise<boolean> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const width = page.viewportSize()?.width ?? 360;
  return Boolean(box) && box!.x >= 0 && box!.x + box!.width <= width;
}
