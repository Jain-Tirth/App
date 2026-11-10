# 02 — Onboarding and Authentication

## 1. Principles

- Ask for one coherent set of facts per screen.
- Never lose a member's input; save per section and keep an offline draft.
- Make mandatory fields explicit before the member invests time.
- Verify identity before any profile becomes visible.
- Tell the member exactly what happens next and how long it takes.

## 2. Language selection (first screen)

**When:** first app open, before landing, if no stored language exists.

**Options:** English, हिन्दी (Hindi), ગુજરાતી (Gujarati).

**Behaviour:**

- Selecting a language applies immediately; the whole UI re-renders in that language.
- The choice is stored locally (`localStorage` for the PWA; secure store later in Expo) and on the account once authenticated.
- A member can change it later in Settings without losing data.
- The initial language may be inferred from the browser when no choice exists, but the member always sees and can override the inferred choice on the first screen.
- All app copy, validation messages, OTP SMS, emails, push notifications and the biodata PDF use the selected language.
- User-generated content (bio, prompts) is never translated.
- Fonts: Noto Sans Devanagari and Noto Sans Gujarati are bundled/served for UI and PDF rendering. Latin fallback is Noto Sans.
- Layout must tolerate 30–40% longer Hindi/Gujarati strings; buttons wrap or grow, never clip.

**Acceptance criteria:**

- A brand-new visitor sees the language screen before any other screen.
- Choosing Hindi changes the next screen to Hindi without a reload.
- The choice survives a reload and a re-login.
- Changing language in Settings does not clear any form field.
- No hardcoded English string is visible in the Hindi or Gujarati UI (except proper nouns and user content).

## 3. Landing / welcome

**Purpose:** explain the product, build trust, route to registration or login.

**Content:**

- Logo and tagline "Tradition • Trust • Togetherness".
- One-line promise: verified Dhobi/Rajaka profiles, private contact, family-friendly.
- Trust badges: 100% verified profiles, privacy assured, community-focused.
- Primary CTA: **Create Profile**.
- Secondary: **Already registered? Log in**.
- Links: Terms, Privacy, Help, Contact.
- Install prompt is **not** shown here; it appears after onboarding (see §11).

**Acceptance criteria:**

- Page is usable at 320 px width.
- Primary CTA is reachable within one thumb tap on a phone.
- Legal links open without losing the registration state.

## 4. Profile created for

**Options:** Myself, Son, Daughter, Brother, Sister, Friend, Relative.

**Rules:**

- Required before account basics.
- Stored on `Users.profileCreatedBy` and shown on the profile as "Profile created by".
- If not "Myself", the form asks for the manager's name and relationship (optional if obvious from the selection, but shown on the profile).
- The person whose profile it is must still be the person in the photos and the ID.
- The member can later transfer management to the profile owner after ownership verification (Phase 2).

**Acceptance criteria:**

- The selection is required and persisted.
- The public profile displays the relationship honestly.
- Selecting "Myself" skips the manager fields.

## 5. Account basics

| Field | Required | Rules |
|---|---|---|
| Full name | Yes | 3–100 chars; letters, spaces, apostrophes, hyphens; no digits or emoji; trimmed |
| Email | Yes | Valid email; max 150 chars; unique (case-insensitive); verification badge optional but encouraged |
| Password | Yes | 8–20 chars; at least one letter and one number; show/hide toggle; never logged; hashed with bcrypt/argon2 |
| Country code | Yes | Default +91; searchable list; dial-code validation |
| Mobile number | Yes | 10 digits for +91; E.164 stored; unique; OTP verified |
| Terms consent | Yes | Checkbox, not pre-checked |
| Privacy consent | Yes | Checkbox, not pre-checked |
| ID-processing consent | Yes | Separate explicit consent; explains purpose, manual admin verification, 24-month retention and rights |
| Marketing consent | No | Opt-in, separate, revocable |

**Consent records:** each accepted consent stores the consent code, document version and hash, the exact text shown, user name, IP address, user agent, granted timestamp, expiry (24 months by default), source and revocation timestamp. The current consent documents are seeded and served by the API; the member can re-read them before accepting. At 24 months the member is prompted to re-consent through the API; declining triggers the documented consequence. Consent records are append-only evidence and are never edited in place.

**Validation and errors:**

- Field-level inline errors, announced to screen readers.
- Duplicate email/mobile: "This email is already registered. Log in or reset your password."
- Rate-limited registration attempts per IP and per mobile.
- Password strength meter is advisory, not a blocker beyond the stated rule.
- The submit button stays enabled and shows errors on submit; it does not silently disable.

**Acceptance criteria:**

- A valid registration creates a pending user and a draft profile, then sends an OTP.
- An invalid email/mobile/password never creates a user.
- Duplicate registration does not reveal whether the email exists beyond the necessary message (documented trade-off for usability).
- Passwords are never returned by any API or written to logs.
- Consent acceptance creates a versioned record with the exact text, user name, IP, user agent and timestamp.
- A member cannot submit a profile without a current ID-processing consent.

## 6. OTP verification

**Delivery:** SMS to the registered mobile. Email OTP is available as a fallback.

**Code:** 6 digits (the reference screens show 4; 6 is the security baseline and is a configuration value).

**Rules:**

| Rule | Value (default) |
|---|---|
| Expiry | 5 minutes |
| Max verify attempts per code | 5 |
| Resend cooldown | 60 seconds |
| Max resends per hour | 5 |
| Max OTP requests per mobile per day | 10 |
| Max OTP requests per IP per hour | 30 |
| Lockout | 30 minutes after max attempts, then support path |
| Code storage | Stateless signed token or hashed short-lived record; never plaintext in logs |
| Replay protection | Single-use; consumed on success |

**Behaviour:**

- Show the masked mobile number and the language of the SMS.
- Show a countdown for resend; explain SMS delays.
- Support "Verify with missed call" only if the SMS provider supports it; otherwise omit.
- On success: create session, mark mobile verified, create/attach draft profile, route to onboarding.
- On failure: generic "That code is incorrect or expired" (do not reveal which).
- On lockout: clear message and support contact.

**Acceptance criteria:**

- A valid code within expiry verifies once and cannot be reused.
- An expired code fails with the correct message.
- Resend respects the cooldown and rate limits.
- OTP values never appear in API responses, logs or analytics.
- A verified session is issued only after a successful OTP.

## 7. Login, logout and password recovery

**Login:** email + password. Mobile + OTP login is a SHOULD for Phase 2.

**Errors:** generic "Email or password is incorrect"; rate-limit after repeated failures; optional CAPTCHA after 5 failures.

**Forgot password:** email a single-use, short-lived reset link/token; do not reveal whether the email exists. Reset invalidates all sessions.

**Session model for the PWA:**

- Access token: short-lived JWT (15 minutes), held in memory only.
- Refresh token: opaque/rotating, `HttpOnly`, `Secure`, `SameSite=Strict` cookie, 30 days, rotated on every use.
- Refresh reuse detection revokes the session family.
- Logout clears the cookie, revokes the session, and clears in-memory state.
- Logout all devices revokes every refresh token for the user.
- CSRF: the refresh endpoint requires a same-site cookie and an anti-CSRF header; state-changing requests use the access token, not the cookie.
- The Expo app will use the same access/refresh model with platform secure storage.

**Acceptance criteria:**

- Refreshing the page keeps the member logged in until the refresh token expires.
- An expired access token is refreshed transparently on the next request.
- A revoked refresh token cannot be reused.
- Logout all devices invalidates every other session.

## 8. Onboarding structure

The wizard is a **hub + sections**, not a rigid linear flow after the first pass.

**First pass order:**

1. Personal
2. Religious
3. Location
4. Education
5. Career
6. Family
7. Lifestyle
8. About, prompts and interests
9. Partner preferences
10. Photos
11. Contact
12. Horoscope (optional)
13. Identity verification
14. Review and submit

**After the first pass:** the hub shows every section with status (complete, incomplete, optional, needs attention), completion percentage and a "Submit" CTA when eligible. Members can jump to any section.

**Per-section behaviour:**

- Required fields are marked with an asterisk and a short reason.
- Save on blur and on section continue; also autosave every 10 seconds while dirty.
- A visible "Saved" / "Saving…" / "Offline — will retry" indicator.
- Draft is written to IndexedDB immediately and to the server when online.
- Leaving a section with unsaved changes prompts once; after that, the draft is kept.
- Server is the source of truth on conflict; the client shows a merge/refresh message rather than silently overwriting.

**Completion weights (sum 100):**

| Section | Weight |
|---|---|
| Identity/account basics | 10 |
| Personal | 15 |
| Religious | 10 |
| Location | 10 |
| Education | 10 |
| Career | 10 |
| Family | 10 |
| Lifestyle (diet/smoking/drinking only) | 5 |
| About, prompts and interests | 10 |
| Partner preferences | 5 |
| Photos (primary approved) | 5 |
| **Total** | **100** |

Contact, horoscope and optional lifestyle fields do not add weight. Verification is a gate, not a percentage.

**Acceptance criteria:**

- Completion is computed server-side and matches across devices.
- An incomplete mandatory section blocks submission with a clear list.
- Autosave never creates duplicate rows or loses the latest value.
- Offline edits are replayed exactly once when connectivity returns.

## 9. Submission gates

The **Submit profile** action is enabled only when all of the following are true:

1. Account basics complete and mobile verified.
2. All mandatory profile sections complete.
3. At least one photo approved and set as primary.
4. Government ID verification status is `passed` or `manualApproved`.
5. ID-processing consent is recorded.
6. Partner preferences meet the minimum (age range, marital status and religion at least).
7. The member has accepted the current Terms version.

If a gate fails, the CTA explains exactly what is missing and deep-links to it. The server re-checks every gate; the client is not trusted.

**On submit:**

- Create an immutable submission snapshot (profile data, photo IDs, verification ID, consent record, timestamp).
- Set profile status to `underReview`; set account status to `pending` (or keep `pending` until approval).
- Start the SLA clock.
- Notify the member: "Submitted. Under review within 24–48 hours."
- Block access to discovery, interests and chat until approval.
- Allow editing? No — edits during review are queued as post-approval changes or require withdrawal. The spec default: editing is locked during review; the member may withdraw the submission to edit.

**Acceptance criteria:**

- No path exists to `underReview` without all gates passing.
- Submitting twice is idempotent and does not create duplicate review items.
- Withdrawal returns the profile to draft and preserves all data.
- The submission snapshot cannot be mutated after creation.

## 10. Profile status state machine

### Account status (`Users.accountStatus`)

`pending` → `active` | `rejected` | `blocked` | `suspended` | `deleted`

### Profile status (new, explicit)

| Status | Meaning | Can enter app? | Can edit? |
|---|---|---|---|
| `draft` | Form not finished | No | Yes |
| `underReview` | Submitted, waiting for admin | No | No (withdraw to edit) |
| `needsChanges` | Admin requested corrections | No | Yes (flagged sections) |
| `approved` | Verified and live | Yes | Yes (post-approval updates) |
| `rejected` | Did not meet terms | No | Limited appeal/edit |
| `suspended` | Temporarily hidden by admin | No | No |
| `blocked` | Banned | No | No |
| `deleted` | Deletion requested/processed | No | No |

**Transition rules:**

- Only the domain service changes status; no controller writes status directly.
- Every transition writes a `ProfileStatusHistory` row with actor, reason, timestamp and metadata.
- `approved` → `suspended`/`blocked` by admin only.
- `needsChanges` → `underReview` on resubmission.
- `rejected` → `underReview` only via an appeal or a new submission after the cooling-off period.
- `approved` edits do not change status; they create a revision record and may trigger re-moderation for photos.

**Acceptance criteria:**

- Illegal transitions return a domain error and write nothing.
- Every transition is visible in the admin history.
- A member cannot reach `approved` through any client call.

## 11. PWA install prompt

**When:** after the member completes the profile and reaches the pending screen, or after the second visit to the home screen. Never on first load.

**How:**

- Android/Chromium: use `beforeinstallprompt`, store the event, show a custom bottom sheet with "Install app" and "Not now".
- iOS Safari: show instructions ("Share → Add to Home Screen") with an illustration.
- Never block the task; dismissal is remembered for 30 days.
- Explain the benefit: faster launch, home-screen icon, notifications (where supported).

**Acceptance criteria:**

- The prompt never appears before onboarding.
- Dismissal is respected.
- Installed mode is detected (`display-mode: standalone`) and the prompt is hidden.
- The app works when launched from the home screen with no browser chrome.

## 12. Notifications during onboarding

| Event | In-app | Push | SMS | Email |
|---|---|---|---|---|
| OTP sent | Yes | No | Yes | If email OTP |
| Registration complete | Yes | No | No | Welcome |
| Profile submitted | Yes | Yes | Yes | Yes |
| Needs changes | Yes | Yes | Yes | Yes |
| Rejected | Yes | Yes | Yes | Yes |
| Approved | Yes | Yes | Yes | Yes |
| Verification failed | Yes | Yes | No | Yes |
| Payment success | Yes | Yes | Yes | Yes (invoice) |

Critical events always have an SMS/email fallback because iOS web push requires an installed PWA.

## 13. Error and recovery states

| Situation | Message and recovery |
|---|---|
| Network offline | "You're offline. Your changes are saved on this device and will sync when you're back." |
| Server 5xx | "Something went wrong. Your draft is safe. Retry." |
| Session expired | Silent refresh; if it fails, "Please log in again" with return-to-screen |
| Duplicate save conflict | "This section was updated on another device. Review the latest version." |
| Photo upload failed | Per-file retry; do not fail the whole section |
| OTP rate-limited | Countdown and support link |
| Verification provider down | "Verification is temporarily unavailable. We'll retry; you can continue other sections." |
| Submission blocked | List of missing gates with deep links |

## 14. Acceptance checklist

- [ ] Language screen appears first and persists.
- [ ] Registration validates all fields and prevents duplicates.
- [ ] OTP expiry, attempts, resend and lockout are enforced server-side.
- [ ] Refresh-token rotation and logout-all work.
- [ ] Every section saves, resumes and survives reload/offline.
- [ ] Completion percentage is server-computed and consistent.
- [ ] Submission gates are enforced server-side.
- [ ] Status transitions are explicit and audited.
- [ ] PWA install prompt appears only after onboarding and respects dismissal.
- [ ] Onboarding notifications use the member's language.
- [ ] No password, OTP or raw ID value appears in logs, analytics or API responses.
