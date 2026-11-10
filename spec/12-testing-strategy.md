# 12 — Testing Strategy

## 1. Principles

- Tests assert **external behaviour**: HTTP status and body, persisted state read back through the API, UI text the member sees, and side effects such as notifications and audit records.
- Tests never assert private methods, internal call order or database implementation details.
- Every acceptance criterion in `SPEC.md` and the appendices maps to at least one test at the right seam.
- A test must fail for a real product regression and pass for any valid implementation of the same contract.
- Deterministic clocks, fixed UUIDs where identity matters, and fakes for all external providers.
- No test depends on the live internet, a real SMS, a real payment or a real KYC provider.
- Security is tested as an authorization matrix, not as one-off checks.

## 2. Seams

Five seams, highest possible, fewest new ones.

### 2.1 Seam 1 — API contract tests (primary)

- Stack: NestJS testing module + Jest + supertest + real PostgreSQL (and Redis where relevant).
- Covers the majority of behaviour: auth, onboarding, profile CRUD, submission, admin review, discovery, interests, shortlists, chat REST, payments, biodata, privacy, DPDP.
- Prior art: `Backend/test/app.e2e-spec.ts`; reuse the existing Jest + supertest setup and the `docker-compose` Postgres (host port 5428) and Redis (6380).
- Each suite runs against a freshly migrated database with factories; no shared mutable state between suites.
- Stored functions are covered through the API, not called directly.

### 2.2 Seam 2 — PWA end-to-end (Playwright)

- Runs against a seeded backend and a production build of the PWA.
- Device profiles: Pixel 7 (Chromium) and iPhone 14 (WebKit), plus one desktop viewport.
- Covers:
  - first-run language selection and persistence;
  - registration, OTP, onboarding section navigation, autosave, resume;
  - photo upload with file fallback, ID verification with fake provider, submission;
  - pending state, approval notification, home recommendations;
  - search filters, profile detail, interest send/accept, shortlist;
  - chat start, message send, reconnect, read receipt;
  - paywall, Razorpay checkout with a fake provider, entitlement unlock;
  - install manifest, offline draft, update prompt;
  - notification deep link;
  - accessibility checks on critical screens.
- No flaky network waits; use API-driven state setup and explicit UI assertions.

### 2.3 Seam 3 — Admin UI (Playwright)

- Runs against a seeded database and the AdminPanel build.
- Covers:
  - MFA login and role-based visibility;
  - review queue ordering and SLA badges;
  - review workspace, document view (audited), approve/request changes/reject;
  - photo moderation and report resolution;
  - member actions (suspend, ban, restore, grant plan, refund);
  - taxonomy edit and cache invalidation;
  - feature flag toggle and maintenance mode;
  - broadcast scheduling;
  - audit search and export;
  - DPDP export/deletion processing.
- Every destructive or decision action asserts the resulting state **and** the audit entry.

### 2.4 Seam 4 — Contract validation

- OpenAPI 3.1 document generated from NestJS and validated in CI.
- PWA and AdminPanel types generated from it; a drift check fails the build.
- Example payloads in tests validate against schemas.
- Breaking-change detection: compare the current document to the last released one and flag removed fields, narrowed enums or changed types.

### 2.5 Seam 5 — Unit tests (pure domain logic)

- No database, no network, no framework.
- Targets:
  - age gate and date math;
  - profile completion computation and weights;
  - one-time-edit rules;
  - compatibility scoring (viewer, reciprocal, dealbreaker cap);
  - recommendation deduplication and diversity;
  - interest state transitions and cooldowns;
  - chat eligibility resolution;
  - entitlement resolution (plan, override, grace, expiry);
  - contact masking and reveal rules;
  - notification preference resolution and quiet hours;
  - Guna Milan kootas and banding;
  - biodata field selection and localization fallback;
  - i18n interpolation, plurals and number/date formatting;
  - price formatting and proration.
- Table-driven tests where the logic is a matrix.

## 3. Test matrix by module

| Module | Unit | API | PWA E2E | Admin E2E | Contract |
|---|---|---|---|---|---|
| Auth/OTP | Age/gate rules | Register, verify, resend, lockout, refresh rotation, logout-all | Register → OTP → onboarding | MFA login | Auth schemes |
| Profile | Completion, edits | Section CRUD, resume, conflicts, one-time edits | Full onboarding, resume, offline draft | Workspace view | DTOs/enums |
| Media | Masking, validation | Upload URL, complete, variants, rejection | Photo upload, capture fallback | Photo queue | Media DTOs |
| Verification | Threshold logic | Session, document, selfie, webhook, retry | Fake KYC flow | Document review, audit | Webhook schema |
| Submission/approval | State machine | Gates, submit, withdraw, decision | Pending → approved | Approve/request changes/reject | Status enums |
| Discovery | Scoring | Recommendations, reverse, new, online, who-viewed | Home feed, filters, profile detail | — | Feed DTOs |
| Search | Filter parsing | Every filter, contradictory ranges, cursor stability | Search flow, empty state | — | Query params |
| Interests | State machine | Send, accept, decline, withdraw, expiry, duplicates | Send/accept flow | — | Interest DTOs |
| Shortlists | Limits | Named lists, many-to-many, limits | Add/remove | — | DTOs |
| Chat | Eligibility | Start, send, history, read, block, rate limit | Chat flow, reconnect | — | Socket events |
| Notifications | Preferences | Event fan-out, preferences, quiet hours, failures | Push permission, deep link | Delivery dashboard | Templates |
| Billing | Entitlements, proration | Launch free mode, plans, orders, verify, webhook, refund, invoices | Paywall → checkout → unlock | Grant/refund | Provider payloads |
| Consent | Versioning | Grant, exact text hash, name/IP/timestamp, 24-month expiry, re-consent, withdrawal | Consent screens | Consent history | Consent DTOs |
| Manual KYC | Admin decision | Photo + ID upload, approve/reject/request changes, audit, age gate | Verification flow | Review queue | Verification DTOs |
| Horoscope | Kootas | Capture, compute, cache, override | Capture/preview | Recompute/override | Chart DTOs |
| Biodata | Field selection | Approval gate, generate, preview, signed URL, localization | Preview/share | Regenerate | PDF metadata |
| Safety | Enforcement ladder | Block, report, evidence, freeze | Report/block flow | Resolve report | Reason codes |
| Admin | Permissions | Role matrix for every endpoint | — | All queues | Admin DTOs |
| Privacy/DPDP | Visibility | Export, delete, consent, retention | Request export/delete | Process request | Consent DTOs |
| Taxonomy | Validation | CRUD, deactivation, cache | Reference data loads | Edit taxonomy | Codes |

## 4. Authorization matrix testing

For every resource and action, test at least:

| Actor | Own resource | Other member's resource | Admin resource |
|---|---|---|---|
| Visitor | 401 | 401 | 401 |
| Member | 200/expected | 403 or 404 | 403 |
| Prime member | 200 | entitlement-dependent | 403 |
| Support | context only | context only | allowed scope |
| Reviewer | — | review scope | allowed scope |
| Moderator | — | moderation scope | allowed scope |
| Analyst | — | aggregates only | aggregates only |
| Super admin | all | all | all |

- Include IDOR cases: changing a path ID or body user ID must not grant access.
- Include role confusion: member token on admin routes and vice versa.
- Include entitlement bypass: direct API calls to premium fields and actions.
- Include block/hide/visibility cases for discovery, profile detail and chat.

## 5. Test data

- Factories for users, profiles, photos, verifications, interests, conversations, orders and reports.
- Named scenarios: `approvedPrimeMale`, `approvedFreeFemale`, `pendingProfile`, `needsChangesProfile`, `blockedPair`, `mutualMatch`, `expiredMembership`, `nriMember`.
- Seed script for local development and Playwright with deterministic data.
- Each suite resets to a known baseline; tests never depend on execution order.
- Time is frozen or offset explicitly for expiry, cooldown and SLA tests.

## 6. Fakes

| Fake | Behaviour |
|---|---|
| `ManualKycProvider` | Always `needsReview`; no OCR/face score; admin decision drives the result |
| `FakeKycProvider` | Deterministic pass/fail/needsReview; can simulate timeout and duplicate ID (used when a managed provider is enabled) |
| `FakePaymentProvider` | Success, failure, delayed webhook, duplicate webhook, refund |
| `FakeSmsProvider` | Captures messages; can simulate failure |
| `FakeEmailProvider` | Captures messages; can simulate bounce |
| `FakePushProvider` | Captures payloads; can simulate expired subscription |
| `FakeStorageProvider` | In-memory object store with signed URL semantics |
| `FakeModerationProvider` | Configurable safe/unsafe/uncertain results |
| `FakeAstrologyEngine` | Reference charts and fixed scores |
| `FakePdfRenderer` | Returns a deterministic PDF stub; separate renderer tests for real output |

Fakes live in a shared test package and are used by API and E2E tests.

## 7. What not to test

- Framework internals, library behaviour or generated code.
- Private methods or implementation call order.
- Exact SQL text.
- Pixel-perfect snapshots as a substitute for behaviour.
- Third-party sandboxes in the default CI run (a separate scheduled job may run provider sandbox tests).
- Trivial getters/setters.

## 8. Coverage targets

| Area | Target |
|---|---|
| Domain logic (unit) | ≥ 90% line, ≥ 85% branch |
| Backend API | ≥ 80% line for public endpoints; 100% of critical negative/authorization paths |
| PWA critical journeys | 100% passing E2E |
| Admin destructive actions | 100% covered |
| Contract | 100% of endpoints documented and validated |
| Accessibility | axe clean on critical screens; manual audit before launch |
| Performance | Lighthouse ≥ 85; budgets met |

Coverage is a floor, not a goal. A high-coverage suite that misses authorization or payment failure paths is not acceptable.

## 9. CI pipeline

1. Install and cache dependencies.
2. Lint and format check.
3. Type-check all packages.
4. Unit tests.
5. Start ephemeral Postgres and Redis; run migrations; run API tests.
6. Generate OpenAPI; validate; check client type drift.
7. Build PWA and AdminPanel.
8. Run Playwright PWA and Admin suites against the built apps and seeded API.
9. Run Lighthouse and axe checks on critical routes.
10. Dependency and container vulnerability scan.
11. Publish artifacts: coverage, Playwright traces, OpenAPI document, Lighthouse report.

- PRs run the full suite; main runs the same plus deployment.
- Failures block merge. Flaky tests are quarantined with an owner and a deadline, never silently retried forever.
- Nightly runs include load tests and provider sandbox tests.

## 10. Environments

| Environment | Purpose | Data |
|---|---|---|
| Local | Development | Seeded fake data |
| CI | Automated tests | Ephemeral, migrated, seeded |
| Staging | Release candidate, UAT, provider sandboxes | Anonymised or synthetic |
| Production | Live | Real, with backups and audit |

- Staging mirrors production configuration, with sandbox provider keys.
- No production data is copied to lower environments without anonymisation.
- Migrations run in staging before production; rollback plans are documented.

## 11. Release gates

A release is blocked by:

- failing unit, API, contract, PWA E2E or Admin E2E tests;
- a failing accessibility check on changed screens;
- a failing Lighthouse performance or installability budget;
- a high/critical dependency or container vulnerability;
- an authorization matrix gap;
- an undocumented API change;
- a migration without a tested rollback or backfill plan.

Payment, verification and privacy changes additionally require a manual review sign-off recorded in the release notes.

## 12. Manual and exploratory testing

- Device matrix: low-end Android (e.g. 3 GB RAM), mid-range Android, iPhone SE-class, iPhone 14-class, desktop Chrome/Safari/Firefox.
- Network conditions: 3G, high latency, packet loss, offline transitions.
- Camera and file upload on real devices, including iOS Safari permission flows.
- Push on installed Android and iOS 16.4+; fallback behaviour without install.
- Screen readers: TalkBack and VoiceOver on critical flows.
- Hindi and Gujarati layouts, long strings, and mixed-script names.
- Payment sandbox: success, failure, pending, duplicate webhook, refund.
- KYC sandbox: pass, unreadable, expired, mismatch, timeout.
- Admin: keyboard-only review, concurrent decisions, stale queue data.

## 13. Acceptance checklist

- [ ] Every acceptance criterion maps to a test.
- [ ] Authorization matrices exist for every resource.
- [ ] No test depends on the internet or a real provider.
- [ ] API tests use a real database and read state back through the API.
- [ ] PWA E2E covers onboarding, discovery, engagement, chat, payments and PWA behaviour.
- [ ] Admin E2E covers every decision and destructive action with audit assertions.
- [ ] Contract drift fails CI.
- [ ] Coverage floors are met.
- [ ] Performance and accessibility budgets are enforced.
- [ ] Flaky tests have owners and deadlines.
- [ ] Release gates are documented and enforced.
