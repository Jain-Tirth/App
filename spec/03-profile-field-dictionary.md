# 03 — Profile Field Dictionary

This is the authoritative field model for the member profile. It is derived from the 8 reference screenshots and the existing schema, and it defines what is required, who can see it, and how it can be edited.

## 1. Conventions

- **Req:** `Y` = required for submission, `N` = optional, `C` = conditional (rule stated), `S` = system-generated.
- **Visibility:** `Public` = any approved member subject to privacy settings; `Premium` = entitled (Prime/Elite) members only; `Match` = accepted matches only; `Private` = owner + authorised admins; `Admin` = admins only.
- **Edit:** `Once` = member may change once after first save, then admin override only; `Free` = editable any time (subject to re-moderation); `Never` = immutable.
- **Source:** `User` = member input; `System` = derived; `Taxonomy` = admin-managed reference data; `Provider` = KYC/payment provider.

## 2. Identity and account

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `userId` | UUID | S | System | Private | Never | Internal primary key |
| `profileUid` | string(15) | S | System, e.g. `DHB4268559` | Public | Never | Searchable profile ID; generated at profile creation |
| `fullName` | string(100) | Y | 3–100 chars, letters/spaces/'- | Public | Free | Display name |
| `email` | string(150) | Y | Valid email, unique | Private by default; Premium if revealed | Free with re-verification | Primary login; verification badge |
| `mobile` | string(15) | Y | E.164, unique | Private; masked until entitlement | Once with OTP | Primary login; OTP verified |
| `passwordHash` | string | Y | bcrypt/argon2 | Private | Free | Never returned |
| `profileCreatedBy` | enum | Y | `myself`, `son`, `daughter`, `brother`, `sister`, `friend`, `relative` | Public | Free | Displayed as "Profile created by" |
| `managedByName` | string(100) | C | Required if not `myself` | Public | Free | Name of the person managing the profile |
| `managedByRelation` | string(50) | C | Derived from `profileCreatedBy` | Public | Free | Display label |
| `accountStatus` | enum | S | `pending`, `active`, `rejected`, `blocked`, `suspended`, `deleted` | Admin | Never (domain service only) | See state machine |
| `profileStatus` | enum | S | `draft`, `underReview`, `needsChanges`, `approved`, `rejected`, `suspended`, `blocked`, `deleted` | Public (approved only) | Never (domain service only) | Gates discovery |
| `role` | enum | S | `user`, `admin` | Admin | Never | RBAC |
| `membershipType` | enum | S | `free`, `prime`, `elite` | Private | Never | Derived from entitlement |
| `language` | enum | Y | `en`, `hi`, `gu` | Private | Free | UI, notifications, biodata |
| `emailVerified` | boolean | S | Provider/OTP | Public badge | Never | Verification badge |
| `mobileVerified` | boolean | S | OTP | Public badge | Never | Required for submission |
| `lastSeenAt` | timestamp | S | System | Configurable | Never | Visibility setting controls display |
| `createdAt` / `updatedAt` | timestamp | S | System | Admin | Never | Audit |
| `deletedAt` | timestamp | S | System | Admin | Never | Soft delete |

## 3. Personal details

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `gender` | enum | Y | `male`, `female` (configurable) | Public | Once | Used in matching and salutations |
| `dateOfBirth` | date | Y | ISO date; men ≥ 21, women ≥ 18 | Public (age); exact DOB Premium | Once | Age derived, never stored as a number |
| `age` | integer | S | Derived from DOB | Public | Never | Recomputed on read |
| `heightCm` | integer | Y | 120–240 cm | Public | Once | UI shows feet/inches + cm |
| `weightKg` | integer | N | 30–200 kg | Public | Free | |
| `bodyType` | enum | N | `slim`, `average`, `athletic`, `heavy` | Public | Free | |
| `maritalStatus` | enum | Y | `neverMarried`, `widower`, `awaitingDivorce`, `divorced` | Public | Once | |
| `physicalStatus` | enum | Y | `normal`, `physicallyChallenged` | Public | Free | Default `normal` |
| `motherTongue` | string | Y | Taxonomy | Public | Once | Matching filter |
| `languagesKnown` | string[] | Y | Taxonomy; at least 1 | Public | Free | Includes mother tongue |
| `residentStatus` | enum | N | `citizen`, `permanentResident`, `workVisa`, `studentVisa`, `dependentVisa`, `other` | Public | Free | Relevant for NRIs |
| `aboutMyself` | text | Y | 100–3000 chars | Public | Free | Plain text, profanity-scanned |
| `lookingFor` | text | Y | 100–3000 chars | Public | Free | Partner expectations narrative |
| `specialCases` | object | N | `thalassemia`: yes/no/unknown; `hiv`: yes/no/unknown; `challenged`: derived from physicalStatus | Match only | Free | Sensitive; hidden from public and search; explicit consent to display |
| `profilePrompts` | array | C | 5 defined prompts; at least 3 answered | Public | Free | Each 40–200 chars |
| `interestTags` | string[] | C | Taxonomy; 3–5 selected | Public | Free | Shown as chips |

### Prompt definitions (seed data)

| Code | Prompt (English) |
|---|---|
| `happy_when` | I am most happy when… |
| `value_partner` | I value a partner who is… |
| `family_bond` | My bond with my family is best described as… |
| `work_life` | Work-life balance for me looks like… |
| `after_work` | After work, you'll usually find me… |

## 4. Religious and community details

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `religion` | string | Y | Taxonomy (Hindu default) | Public | Once | |
| `community` | string | Y | Taxonomy (Dhobi, Rajaka, etc.) | Public | Once | Displayed as "Caste/Community" |
| `subcaste` | string | C | Taxonomy; required unless "Don't know" | Public | Once | Dhobi/Rajaka sub-groups |
| `openToAnySubcaste` | boolean | N | Default false | Public | Free | Suppresses sub-caste filtering |
| `gothra` | string | N | Taxonomy + free text | Public | Once | |
| `dosh` | enum | N | `no`, `yes`, `dontKnow` | Premium | Free | |
| `manglik` | enum | N | `no`, `yes`, `dontKnow` | Premium | Free | |
| `horoscopeMatchMust` | boolean | N | Default false | Public | Free | Shown on profile |

**Rules:**

- If `openToAnySubcaste` is true, `subcaste` is not required and the member is not excluded by sub-caste filters.
- Religion/community/sub-caste options come from taxonomy, not free text, except an explicit "Other" that requires admin review.
- Changing religion/community/sub-caste after first save counts as the one allowed edit.

## 5. Location details

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `country` | string | Y | Taxonomy (frequently selected + all) | Public | Free | |
| `state` | string | C | Taxonomy; required if country = India | Public | Free | |
| `city` | string | Y | Taxonomy + free text for non-India | Public | Free | |
| `citizenship` | string | N | Taxonomy | Public | Free | NRI relevance |
| `interestedSettlingAbroad` | enum | N | `yes`, `no`, `maybe` | Public | Free | |
| `familyBasedOutOf` | string | N | City, state, country | Public | Free | Family section |
| `livingWithParents` | boolean | N | Yes/No | Public | Free | Family section |

**Rules:**

- Country change resets state/city if they are no longer valid.
- Non-India addresses use free-text state/city with country-specific validation where available.
- Search filters use the taxonomy codes, not display strings.

## 6. Education

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `highestDegree` | string | Y | Taxonomy (e.g. BCA, MCA, B.Tech, MBA, MBBS, LLM) | Public | Free | Drives education level |
| `educationLevel` | enum | S | `school`, `diploma`, `undergraduate`, `postgraduate`, `doctorate`, `other` | Public | Never | Derived from degree |
| `aboutEducation` | text | N | Max 500 chars | Public | Free | |
| `postGraduation` | object | N | `{degree, specialisation, institute, year}` | Public | Free | Shown if present |
| `underGraduation` | object | N | `{degree, specialisation, institute, year}` | Public | Free | |
| `school` | object | N | `{name, board, year}` | Public | Free | |
| `additionalQualifications` | string[] | N | Free text + taxonomy | Public | Free | |
| `educationVerified` | boolean | S | Admin | Public badge | Never | Phase 2 optional |

**Rules:**

- `year` must be between 1950 and the current year.
- Institute is free text with autocomplete from the taxonomy where available.
- At least `highestDegree` is required; the rest are optional but improve ranking.

## 7. Career

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `employmentType` | enum | Y | `private`, `business`, `defence`, `governmentPsu`, `notWorking`, `selfEmployed` | Public | Free | |
| `occupation` | string | Y | Taxonomy (grouped: frequently selected + categories) | Public | Free | |
| `employer` | string | N | Max 150 chars | Public | Free | |
| `incomeCurrency` | string | C | ISO 4217; default INR | Public | Free | Required if income provided |
| `annualIncomeRange` | string | Y | Taxonomy ranges, including "Prefer not to say" | Premium | Free | Exact income never stored |
| `aboutCareer` | text | N | Max 500 chars | Public | Free | |
| `workingAbroad` | boolean | N | Yes/No | Public | Free | Derived from location if possible |
| `interestedSettlingAbroad` | enum | N | `yes`, `no`, `maybe` | Public | Free | Shared with location |

**Rules:**

- `notWorking` still requires an occupation selection such as "Student" or "Homemaker".
- Income is a range, never a number. "Prefer not to say" is allowed and is not penalised in ranking.
- Occupation and education taxonomies are shared with partner preferences.

## 8. Family

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `familyType` | enum | Y | `nuclear`, `joint` | Public | Free | |
| `familyValues` | enum | Y | `liberal`, `moderate`, `traditional` | Public | Free | |
| `familyStatus` | enum | Y | `middleClass`, `upperMiddleClass`, `rich`, `affluent` | Public | Free | Reference uses Middle/Upper Middle/Rich/Affluent |
| `familyIncomeRange` | string | N | Taxonomy | Premium | Free | |
| `fatherOccupation` | string | C | Taxonomy or status | Public | Free | Required if father living |
| `fatherStatus` | enum | Y | `living`, `passedAway`, `notApplicable` | Public | Free | |
| `motherOccupation` | string | C | Taxonomy or status | Public | Free | Required if mother living |
| `motherStatus` | enum | Y | `living`, `passedAway`, `notApplicable` | Public | Free | |
| `brothersCount` | integer | Y | 0–20 | Public | Free | |
| `sistersCount` | integer | Y | 0–20 | Public | Free | |
| `marriedSiblingsCount` | integer | N | 0–40 | Public | Free | |
| `siblingDetails` | array | N | `{relation, age, maritalStatus, occupation}` per sibling | Premium | Free | Adds visibility for Prime members per reference |
| `livingWithParents` | boolean | Y | Yes/No | Public | Free | |
| `familyBasedOutOf` | string | Y | City/state/country | Public | Free | |
| `aboutFamily` | text | N | Max 1000 chars | Public | Free | |

**Rules:**

- Parent occupation is hidden if status is `passedAway` or `notApplicable`; the status is public.
- Sibling details are optional and never required for submission.
- Family income is a range and is Premium-visible.

## 9. Lifestyle

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `dietaryHabits` | enum | Y | `vegetarian`, `nonVegetarian`, `eggetarian`, `vegan`, `jain` | Public | Free | |
| `smokingHabits` | enum | Y | `never`, `occasionally`, `regularly` | Public | Free | |
| `drinkingHabits` | enum | Y | `never`, `occasionally`, `regularly` | Public | Free | |
| `openToPets` | boolean | Y | Yes/No | Public | Free | |
| `ownsHouse` | boolean | N | Yes/No | Public | Free | Assets |
| `ownsCar` | boolean | N | Yes/No | Public | Free | Assets |
| `foodICook` | string[] | N | Taxonomy + free text | Public | Free | |
| `hobbies` | string[] | N | Taxonomy; up to 10 | Public | Free | |
| `interests` | string[] | N | Taxonomy; up to 10 | Public | Free | |
| `favouriteMusic` | string[] | N | Taxonomy; up to 10 | Public | Free | |
| `favouriteBooks` | string[] | N | Taxonomy; up to 10 | Public | Free | |
| `dressStyle` | string[] | N | Taxonomy; up to 5 | Public | Free | |
| `sports` | string[] | N | Taxonomy; up to 10 | Public | Free | |
| `favouriteCuisine` | string[] | N | Taxonomy; up to 10 | Public | Free | |
| `favouriteMovies` | string[] | N | Taxonomy + free text; up to 10 | Public | Free | |
| `favouriteRead` | string | N | Max 200 chars | Public | Free | |
| `favouriteTvShows` | string[] | N | Taxonomy + free text; up to 10 | Public | Free | |

**Rules:**

- Diet, smoking, drinking and pets are required because they are primary compatibility filters.
- Multi-select values are de-duplicated, trimmed and capped.
- Free-text entries are profanity-scanned and length-limited.

## 10. Contact details

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `email` | string | Y | Account email | Private / Premium / Match / Everyone | Free with re-verification | Per-field visibility |
| `alternateEmail` | string | N | Valid email | Private / Premium / Match / Everyone | Free | Verified optionally |
| `mobile` | string | Y | Account mobile | Private / Premium / Match / Everyone | Once with OTP | Masked in all read models until revealed |
| `alternateMobile` | string | N | E.164 | Private / Premium / Match / Everyone | Free | |
| `whatsappNumber` | string | N | E.164, consent required | Private / Premium / Match / Everyone | Free | Explicit WhatsApp consent |
| `landline` | string | N | Digits, 6–15 | Private / Premium / Match / Everyone | Free | |
| `contactVisibilityDefault` | enum | Y | `private`, `matches`, `prime`, `everyone` | Private | Free | Default `private` |
| `preferredContactMethod` | enum | N | `chat`, `phone`, `email`, `whatsapp` | Match | Free | |
| `contactRevealAudit` | records | S | Who revealed what, when | Admin | Never | Audit |

**Rules:**

- Contact is private by default; the public profile shows "Contact hidden".
- A member can set a different visibility for each field.
- Even if visibility is `everyone`, the API only returns the value to entitled members; `everyone` means "any approved member who is entitled".
- Revealing a contact is an audited action; the owner can see who viewed it (Phase 2).
- Masking format: `+91 98******10`, email `r****@gmail.com`.

## 11. Horoscope

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `birthCountry` | string | C | Taxonomy; required if horoscope enabled | Premium | Free | |
| `birthState` | string | C | Taxonomy/free text | Premium | Free | |
| `birthCity` | string | C | Taxonomy/free text | Premium | Free | |
| `birthDate` | date | S | Prefilled from DOB | Premium | Never | |
| `birthTime` | time | N | HH:mm, 12/24h display | Premium | Free | Required for chart generation |
| `birthTimeAccuracy` | enum | N | `exact`, `approximate`, `unknown` | Premium | Free | |
| `rashi` | string | N | Taxonomy (Moon sign) | Premium | Free | Auto-computed or manual |
| `nakshatra` | string | N | Taxonomy | Premium | Free | Auto or manual |
| `manglik` | enum | N | `no`, `yes`, `dontKnow` | Premium | Free | Mirrors religious section |
| `dosh` | enum | N | `no`, `yes`, `dontKnow` | Premium | Free | |
| `horoscopeMatchMust` | boolean | N | Default false | Public | Free | |
| `janampatriFileUrl` | string | N | PDF/image, max 10 MB | Premium | Free | Private signed URL; owner + entitled |
| `chartStyle` | enum | N | `northIndian`, `southIndian` | Premium | Free | |
| `kundliScore` | integer | S | 0–36 | Premium | Never | Computed against a specific match |
| `horoscopeSource` | enum | S | `computed`, `manual`, `uploaded` | Admin | Never | Transparency |

**Rules:**

- Without birth time, only rashi/nakshatra approximations are shown; the chart is unavailable.
- The member can override computed values, but the source is recorded.
- Horoscope fields are Premium-visible by default; the owner can make them public.
- The janampatri file is never indexed or public.

## 12. Partner preferences

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `prefAgeMin` / `prefAgeMax` | integer | Y | 18–80, min ≤ max | Public | Free | Match count uses this |
| `prefHeightMinCm` / `prefHeightMaxCm` | integer | Y | 120–240 | Public | Free | |
| `prefMaritalStatus` | string[] | Y | Marital enum; at least 1 | Public | Free | |
| `prefMotherTongue` | string[] | N | Taxonomy | Public | Free | |
| `prefPhysicalStatus` | string[] | N | Physical enum | Public | Free | |
| `prefEatingHabits` | string[] | N | Diet enum | Public | Free | |
| `prefSmokingHabits` | string[] | N | Smoking enum | Public | Free | |
| `prefDrinkingHabits` | string[] | N | Drinking enum | Public | Free | |
| `prefReligion` | string[] | Y | Taxonomy; "Any" allowed | Public | Free | |
| `prefCaste` | string[] | N | Taxonomy; "Any" allowed | Public | Free | |
| `prefSubcaste` | string[] | N | Taxonomy; "Any" allowed | Public | Free | |
| `openToAnyCaste` | boolean | N | Default false | Public | Free | |
| `prefCountry` | string[] | N | Taxonomy | Public | Free | |
| `prefState` | string[] | N | Taxonomy | Public | Free | |
| `prefCity` | string[] | N | Taxonomy | Public | Free | |
| `prefCitizenship` | string[] | N | Taxonomy | Public | Free | |
| `prefEducation` | string[] | N | Taxonomy | Public | Free | |
| `prefEmploymentType` | string[] | N | Employment enum | Public | Free | |
| `prefOccupation` | string[] | N | Taxonomy | Public | Free | |
| `prefIncomeMin` / `prefIncomeMax` | integer | N | Annual, INR or chosen currency | Premium | Free | |
| `openToInterCaste` | boolean | N | Default false | Public | Free | |
| `openToInterReligion` | boolean | N | Default false | Public | Free | |
| `prefHoroscopeMatch` | boolean | N | Default false | Public | Free | |
| `dealbreakers` | string[] | N | Field keys from a controlled list | Public | Free | Used in scoring |
| `matchCount` | integer | S | 0–21 | Public | Never | Computed against a specific profile |

**Rules:**

- Age and religion preferences are mandatory so the engine always has a baseline.
- "Any" is represented as an empty array with an explicit boolean, not a magic string.
- Dealbreakers are a subset of preference fields; a failed dealbreaker caps the compatibility score.
- Preferences are not used to exclude the member from others' results unless the reciprocal side matches.

## 13. Photos

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `photos` | array | Y | 1–10 images | Configurable | Free | Primary required |
| `primaryPhotoId` | UUID | Y | One of `photos` | Public | Free | First photo by default |
| `sortOrder` | integer | S | 0..n | Public | Free | Drag to reorder |
| `caption` | string | N | Max 100 chars | Public | Free | Optional |
| `photoVisibility` | enum | Y | `everyone`, `prime`, `matches`, `private` | Private | Free | Applies to gallery |
| `validationStatus` | enum | S | `pending`, `approved`, `rejected` | Public badge | Never | Per photo |
| `rejectionReason` | string | S | Controlled vocabulary | Owner | Never | Shown to owner |
| `isPrimary` | boolean | S | Exactly one | Public | Free | |
| `phash` | string | S | Perceptual hash | Admin | Never | Duplicate detection |
| `moderationScore` | number | S | 0–1 | Admin | Never | Auto-moderation |

**Rules:**

- Exactly one primary photo; deleting it promotes the next approved photo.
- Photos are re-encoded, EXIF-stripped and resized into 320/640/1080 variants.
- Minimum 400×400 px; max 10 MB; JPEG/PNG/WebP.
- Rejected photos are hidden but retained for appeal until the retention window ends.
- A profile cannot be submitted without one approved primary photo.

## 14. Privacy and settings

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `profileVisibility` | enum | Y | `all`, `prime`, `matches`, `hidden` | Private | Free | Hidden removes from discovery |
| `photoVisibility` | enum | Y | `everyone`, `prime`, `matches`, `private` | Private | Free | Overrides photo default |
| `contactVisibility` | enum | Y | `private`, `matches`, `prime`, `everyone` | Private | Free | Per-field overrides allowed |
| `lastSeenVisibility` | enum | Y | `everyone`, `matches`, `nobody` | Private | Free | |
| `onlineStatusVisibility` | enum | Y | `everyone`, `matches`, `nobody` | Private | Free | |
| `searchEngineIndexing` | boolean | S | Always false for member profiles | Admin | Never | Privacy |
| `notificationPrefs` | object | Y | Per event × channel | Private | Free | In-app, push, SMS, email |
| `blockedUsers` | array | S | Managed list | Private | Free | Enforced in discovery/chat |
| `hiddenProfiles` | array | S | Managed list | Private | Free | Ignore list |
| `shortlists` | array | S | Named collections | Private | Free | See engagement |
| `consentRecords` | array | S | Terms, privacy, ID, marketing | Admin + owner | Never | Versioned, timestamped |
| `dataExportRequests` | array | S | Status | Owner | Never | DPDP |
| `deletionRequest` | object | S | Status, cooling-off end | Owner | Never | DPDP |

## 15. Verification fields (owner sees status; admin sees evidence)

| Field | Type | Req | Options / format | Visibility | Edit | Notes |
|---|---|---|---|---|---|---|
| `documentType` | enum | Y | `aadhaar`, `pan`, `drivingLicence`, `rationCard`, `voterId`, `other` | Admin | Once per attempt | Accepted types |
| `documentNumber` | string | C | Masked; last 4 visible | Owner + Admin | Never | Encrypted at rest |
| `frontImageUrl` | string | Y | Private signed URL | Admin | Never | Deleted per retention |
| `backImageUrl` | string | N | Private signed URL | Admin | Never | If applicable |
| `selfieUrl` | string | Y | Private signed URL | Admin | Never | Liveness capture |
| `ocrName` | string | S | Provider | Admin | Never | Name match |
| `ocrDob` | date | S | Provider | Admin | Never | Age check |
| `ocrConfidence` | number | S | 0–1 | Admin | Never | Threshold |
| `faceMatchScore` | number | S | 0–1 | Admin | Never | ID vs selfie vs profile photo |
| `livenessScore` | number | S | 0–1 | Admin | Never | Provider score |
| `ageVerified` | boolean | S | Admin + server | Owner badge | Never | Men 21+, women 18+ |
| `nameMatchScore` | number | S | 0–1 | Admin | Never | Fuzzy match |
| `verificationStatus` | enum | S | `notStarted`, `uploaded`, `processing`, `passed`, `needsReview`, `failed`, `manualApproved`, `manualRejected` | Owner + Admin | Never | State machine |
| `adminNote` | string | S | Free text | Admin | Free | Internal |
| `reviewedBy` / `reviewedAt` | UUID / timestamp | S | Admin | Admin | Never | Audit |
| `retentionDeleteAt` | timestamp | S | System | Admin | Never | Scheduled deletion |

## 16. Admin-only fields

| Field | Purpose |
|---|---|
| Submission snapshot | Immutable record of what was reviewed |
| Review decision and reason code | Audit and member messaging |
| One-time-edit override | Correct genuine mistakes with a reason |
| Account suspension/ban reason | Enforcement history |
| Membership grant/revoke | Support recovery |
| Internal notes | Reviewer context |
| Document access log | Every view of ID evidence |
| Impersonation-free support view | Read-only member context; no login as member |
| Feature flags / announcements | Operations |
| Taxonomy edit history | Reference data audit |

## 17. Completion weights (authoritative)

| Section | Weight | Required fields counted |
|---|---|---|
| Identity/account | 10 | name, email, mobile verified, profileCreatedBy, gender, DOB |
| Personal | 15 | height, marital status, physical status, mother tongue, languages |
| Religious | 10 | religion, community, sub-caste (or open), gothra/manglik (if provided) |
| Location | 10 | country, state (India), city |
| Education | 10 | highest degree |
| Career | 10 | employment type, occupation, income range |
| Family | 10 | type, values, status, parents' status, sibling counts, living with parents, family base |
| Lifestyle | 5 | diet, smoking, drinking, pets |
| About/prompts/interests | 10 | aboutMyself, lookingFor, 3 prompts, 3 interest tags |
| Partner preferences | 5 | age range, marital status, religion |
| Photos | 5 | one approved primary photo |
| **Total** | **100** | |

This table is the canonical server calculation. Implementations must expose one consistent completion number across the PWA, admin and API.

## 18. One-time-edit fields

`gender`, `dateOfBirth`, `religion`, `community`, `subcaste`, `heightCm`, `maritalStatus`, `motherTongue`.

Rules:

- First save is free.
- One subsequent change is allowed, recorded with old/new values and timestamp.
- A third change requires an admin override with a reason.
- Changing DOB re-runs the age gate and may invalidate verification; the member is warned.
- Changing religion/community/subcaste may reset matching caches.

## 19. Sensitive fields and visibility

| Field group | Default visibility | Notes |
|---|---|---|
| Full name, age, height, marital status, city | Public | Core profile |
| Exact DOB, birth time, rashi, nakshatra, kundli score | Premium | Reference app locks these |
| Income range, family income | Premium | Never exact income |
| Contact details | Private | Per-field control; audit on reveal |
| ID documents and numbers | Admin | Never public; masked to owner |
| Special cases (thalassemia, HIV) | Match | Explicit consent; excluded from search and public profile |
| Sibling details | Premium | Optional |
| Janampatri file | Premium | Signed URL |
| Last seen / online | Configurable | Default matches-only |

## 20. Validation summary

| Rule | Behaviour |
|---|---|
| Age below minimum | Block save with a clear message; do not create a profile |
| Height outside 120–240 cm | Reject |
| Weight outside 30–200 kg | Reject |
| DOB in the future | Reject |
| Income exact value | Not accepted; ranges only |
| Duplicate email/mobile | Reject with login/reset guidance |
| Free text > limit | Reject with a counter |
| Invalid enum | Reject at the API boundary |
| Unknown taxonomy code | Reject; do not silently accept |
| Photo < 400×400 | Reject with guidance |
| ID type not accepted | Reject with the accepted list |
| ID expired | Reject with "expired document" and retry |
| ID name/DOB mismatch | Route to manual review, not automatic rejection |
| Multiple primary photos | Reject; enforce exactly one |
| Preference min > max | Reject with a range error |
| Empty preference list where required | Reject with a clear message |
