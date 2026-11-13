# 15 — Security Specification and Stories

This appendix expands `10-non-functional.md` §1 into testable security stories. `SPEC.md` ("Security Specification") is the summary; this file is the detail. MUST / SHOULD / MAY follow RFC 2119 intent. Story IDs (`SEC-xx`) are stable and are referenced by tests and release notes.

**Roles used below:** Visitor (unauthenticated), Member, Admin (super admin, reviewer, moderator, support, analyst), Platform (system behaviour), Attacker (adversarial actor, used in abuse cases).

## 1. Threat model summary

| Asset | Threat | Primary controls |
|---|---|---|
| Government ID images and numbers | Leak, insider browsing, scraping | Field encryption, masking, signed URLs, admin view audit, retention purge |
| Member PII and contact details | Scraping, IDOR, unauthorised reveal | Object-level authz, privacy at query layer, entitlement gate, rate limits |
| Accounts | Credential stuffing, OTP abuse, session theft | Hashing, lockout, OTP limits, rotating refresh tokens, device sessions |
| Admin back office | Phishing, privilege escalation | MFA, RBAC, IP/step-up policy, immutable audit |
| Payments | Forged webhooks, replay, entitlement fraud | Signature verification, idempotency, server-side entitlement |
| Chat and reports | Harassment, spam, off-platform solicitation | Eligibility rules, rate limits, scanning, block/report |
| Uploads and media | Malware, polyglot files, EXIF leaks | Content sniffing, AV scan, re-encode, EXIF strip |
| Infrastructure and supply chain | Secret leak, vulnerable dependency | Secret manager, scanning in CI, least-privilege roles |

## 2. Stories

Each story has acceptance criteria (AC). Every AC maps to at least one test at the seam named in `12-testing-strategy.md`.

### 2.1 Authentication and sessions

**SEC-01 — Strong password storage.** As a member, I want my password stored irreversibly, so that a database leak does not expose it.
- AC: bcrypt cost ≥ 12 or argon2id; hash never returned by any endpoint or written to logs.
- AC: passwords below 8 chars, in a common-password list, or equal to email/mobile are rejected with field-level errors.

**SEC-02 — Login throttling and lockout.** As a member, I want repeated bad logins slowed, so that attackers cannot brute force my account.
- AC: per-account and per-IP limits; progressive delay after 5 failures; temporary lock after 10 in 15 minutes.
- AC: responses for unknown email and wrong password are identical in body and timing class (no user enumeration).
- AC: lock and suspicious-login events notify the member by email/SMS.

**SEC-03 — OTP hardening.** As a visitor, I want OTPs that cannot be guessed or replayed, so that my number cannot be hijacked.
- AC: 6 digits from a CSPRNG, hashed at rest, single-use, expire in 5 minutes.
- AC: max 5 verify attempts per OTP, max 5 sends per mobile per hour, 30-second resend cooldown, per-IP and per-device velocity caps.
- AC: an OTP for one purpose (register, reset, step-up) cannot be used for another.

**SEC-04 — Short-lived access, rotating refresh.** As a member, I want sessions that survive normal use but die when stolen, so that a leaked token has limited value.
- AC: access JWT 15 minutes, in memory only, never in `localStorage`.
- AC: refresh token opaque, hashed at rest, `HttpOnly`, `Secure`, `SameSite=Strict`, rotated on every use.
- AC: reuse of a rotated refresh token revokes the whole token family and alerts the member.

**SEC-05 — Device session management.** As a member, I want to see and revoke my signed-in devices, so that I can cut off a lost phone.
- AC: list shows device label, last active, coarse location, current-session flag.
- AC: revoke one, revoke all others, and "log out everywhere" take effect within one access-token lifetime.
- AC: password change and reset revoke all other sessions.

**SEC-06 — Secure password reset.** As a member, I want recovery that an attacker cannot abuse.
- AC: reset token single-use, hashed, expires in 30 minutes; request response is identical for known and unknown accounts.
- AC: reset requires proof of mobile or email ownership; member is notified when a reset completes.

**SEC-07 — Step-up for sensitive actions.** As a member, I want re-verification for risky changes, so that a hijacked session cannot do lasting damage.
- AC: changing email, mobile, password, or requesting export/deletion requires a fresh OTP or password within the last 10 minutes.

**SEC-08 — Local unlock is not authentication.** As a member, I want optional biometric/device unlock, so that a borrowed phone cannot open the app.
- AC: unlock gates the UI only; the server never accepts it as an auth factor; disabling it never weakens server checks.

### 2.2 Authorization and object-level access

**SEC-09 — Server-side authorization everywhere.** As the platform, I want every endpoint to enforce role and ownership, so that hiding a button is never the only protection.
- AC: an authorization matrix (endpoint × role × ownership) exists and runs in CI; any endpoint without a matrix row fails the build.
- AC: client-supplied user IDs are ignored for identity; identity comes from the verified token only.

**SEC-10 — No IDOR on member resources.** As a member, I want other members unable to read or change my resources by guessing IDs.
- AC: profiles, photos, documents, shortlists, interests, conversations, orders, notifications and tickets return 404 (not 403) for non-owners where existence would leak.
- AC: UUIDs are used; sequential IDs are never exposed.

**SEC-11 — Privacy enforced at the query layer.** As a member, I want blocked, hidden and privacy-restricted data excluded in the database query, so that a client bug cannot expose it.
- AC: block, hide, photo-visibility and contact-visibility rules are applied in the data access layer and covered by API tests.
- AC: a blocked member gets the same response as a non-existent profile.

**SEC-12 — Entitlement checks are server-side.** As the platform, I want gated features checked by `EntitlementService`, so that a modified client cannot unlock paid features.
- AC: contact reveal, chat and who-viewed-me return `403 ENTITLEMENT_REQUIRED` without entitlement even if the UI is bypassed.
- AC: the full contact value is never present in any response before entitlement; masked values are produced server-side.

**SEC-13 — Mass-assignment protection.** As the platform, I want request bodies whitelisted, so that an attacker cannot set `role`, `status`, `isVerified` or similar fields.
- AC: DTOs use an explicit allowlist; unknown fields are rejected or stripped; status fields change only through the state machine.

### 2.3 Admin and back office

**SEC-14 — Mandatory admin MFA.** As the business, I want every admin to use MFA, so that a stolen password cannot open the back office.
- AC: TOTP or WebAuthn enrolment is forced at first login; no admin session exists without MFA; recovery codes are single-use and hashed.
- AC: admin tokens live ≤ 30 minutes idle, ≤ 8 hours absolute, and are separate from member tokens.

**SEC-15 — Least-privilege admin roles.** As the business, I want each role limited to what it needs.
- AC: reviewers see ID documents; support does not; analysts see aggregates only; only super admin edits roles, flags and config.
- AC: role changes require a second super admin approval and are audited.

**SEC-16 — Immutable, tamper-evident audit.** As an auditor, I want a record I can trust.
- AC: every ID view, decision, role change, override, export, deletion and impersonation writes an append-only entry with actor, subject, action, reason, IP, user agent, timestamp.
- AC: the application database role cannot update or delete audit rows; entries are hash-chained or shipped to write-once storage; exports are themselves audited.

**SEC-17 — Admin access guardrails.** As the business, I want unusual admin behaviour contained.
- AC: bulk ID views above a configured rate raise an alert and require a reason; admin login from a new device or country triggers step-up; admin panel can be restricted by IP allowlist per environment.

### 2.4 Data protection and privacy

**SEC-18 — Encryption in transit and at rest.** As a member, I want my data protected on the wire and on disk.
- AC: TLS 1.2+ only, HSTS ≥ 1 year with preload eligibility; database, object storage and backups encrypted at rest.

**SEC-19 — Field-level encryption and masking.** As a member, I want my most sensitive values protected even from database readers.
- AC: ID numbers, contact fields and ID image keys use envelope encryption with a KMS-held key; keys rotate without downtime.
- AC: ID numbers are masked (last 4 only) in every read model; full value is admin-only, reason-gated and audited.

**SEC-20 — Private media with signed URLs.** As a member, I want photos and documents never publicly reachable.
- AC: buckets block public access; URLs are signed, 5–15 minutes, bound to the requesting member where feasible; expired or tampered URLs return 403.
- AC: responses carry `Cache-Control: private, no-store` for documents.

**SEC-21 — PII-free logs and telemetry.** As the platform, I want logs safe to share with engineers.
- AC: a redaction layer strips passwords, tokens, OTPs, ID numbers, contact values and message bodies from logs, traces, error trackers, analytics and push payloads; a CI check fails on known PII patterns in log fixtures.

**SEC-22 — Retention and purge.** As a member, I want my data not kept longer than needed.
- AC: raw ID images are deleted at the retention window leaving result, hash and audit record; deleted accounts are purged after the 30-day cooling-off; financial and audit records are retained only as required by law.
- AC: backups age out within a documented window so deletions eventually propagate.

**SEC-23 — Consent integrity.** As a member, I want consent captured provably.
- AC: records are append-only and versioned (text, hash, name, IP, user agent, timestamp, expiry); withdrawal is a new record, not an edit; re-consent is enforced at 24 months.

**SEC-24 — Breach readiness.** As a member, I want to be told if my data is breached.
- AC: a written incident-response plan names roles, severity levels and a notification path to the regulator and affected members within statutory timelines; a tabletop exercise runs before launch and annually.

### 2.5 Application security

**SEC-25 — Input validation and output encoding.** As the platform, I want hostile input neutralised.
- AC: every endpoint validates body, query and path against a schema; free text is length-limited and stored raw but encoded on output; no `dangerouslySetInnerHTML` on user content.

**SEC-26 — Injection-proof data access.** As the platform, I want no SQL injection.
- AC: parameterised queries only, including inside stored-function calls; a lint rule forbids string-built SQL; sort and filter fields are allowlisted.

**SEC-27 — CSRF and CORS.** As a member, I want cross-site requests unable to act as me.
- AC: state-changing calls require a bearer token; the refresh endpoint additionally requires a CSRF token or custom header and `SameSite=Strict`; CORS allows only the exact PWA and admin origins, no wildcard with credentials.

**SEC-28 — Browser security headers and CSP.** As the platform, I want the browser to help stop XSS and framing.
- AC: strict CSP (no `unsafe-inline` scripts, nonce or hash based), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` limited to camera and needed features, `frame-ancestors 'none'`; verified by an automated header test on both apps.

**SEC-29 — Safe file uploads.** As the platform, I want uploads unable to carry malware or exploits.
- AC: type detected by content (magic bytes), not extension or client MIME; size and dimension caps; antivirus scan before the file leaves quarantine; images re-encoded and EXIF/GPS removed; PDFs for janampatri are sanitised or rasterised.
- AC: uploads land in a quarantine prefix and are unreachable until scanned and approved.

**SEC-30 — SSRF and outbound control.** As the platform, I want the server unable to be turned into a proxy.
- AC: the API fetches no user-supplied URLs; any outbound call (providers, webhooks) goes to an allowlisted host; private and metadata IP ranges are blocked.

**SEC-31 — Rate limiting and abuse controls.** As the platform, I want expensive or abusable actions capped.
- AC: distinct limits for login, OTP, registration, search, profile views, interests, messages, uploads, reports and payments, keyed by account, IP and device; exceeding returns `429` with `Retry-After`.
- AC: search and profile-view limits plus pagination caps make bulk scraping impractical; sequential scraping patterns raise an alert and a soft block.

**SEC-32 — Service worker and PWA safety.** As a member, I want the installed app not to leak or serve stale insecure code.
- AC: the service worker never caches authenticated API responses or signed media URLs; caches are cleared on logout; IndexedDB drafts exclude government ID data and are cleared on logout; a minimum-version gate can force an update.

**SEC-33 — Realtime channel security.** As a member, I want chat connections that cannot be hijacked.
- AC: Socket.io handshake validates the access token and re-validates on token refresh; rooms are joined only after a server-side eligibility check; per-socket and per-conversation message rate limits; origin check on connect.

### 2.6 Fraud, trust and abuse

**SEC-34 — Fake and duplicate profile defence.** As a member, I want fewer fake profiles.
- AC: duplicate ID number (by keyed hash), duplicate mobile/email, and perceptual-hash photo matches route to manual review rather than auto-approve; reused-photo reports are triaged.

**SEC-35 — Harassment and scam controls.** As a member, I want unwanted contact stopped.
- AC: block is immediate and symmetric in visibility; contact-info and payment-solicitation patterns in bios and chat are flagged and rate-limited; repeated reports auto-hide a profile pending review; every enforcement action is audited.

**SEC-36 — Account takeover recovery.** As a member, I want a path back if my account is hijacked.
- AC: support-assisted recovery requires identity proof and is audited; the member is notified of email/mobile changes on the old contact with a short revert window.

**SEC-37 — Enumeration resistance.** As a member, I want my presence on the platform not discoverable.
- AC: registration, login, reset and "check availability" responses do not reveal whether an email or mobile exists; profile IDs are random and non-sequential.

### 2.7 Payments

**SEC-38 — Verified payment webhooks.** As the business, I want forged payments impossible.
- AC: Razorpay signature verified against the raw body; timestamp tolerance; processing idempotent on provider event ID; amount, currency and order are matched server-side before any entitlement grant.
- AC: no card data touches our servers; the client never decides payment success.

**SEC-39 — Entitlement integrity and refund safety.** As the business, I want entitlement changes traceable.
- AC: grants, revokes and refunds are audited with actor and reason; a refund removes the entitlement it paid for; manual grants require a reason and are rate-limited per admin.

### 2.8 Supply chain, infrastructure and operations

**SEC-40 — Secrets management.** As the platform, I want no secret in code or bundles.
- AC: secrets come from a managed store; a secret scanner runs on every commit and in CI; client bundles are scanned for keys; VAPID, JWT and encryption keys are per environment and rotatable with overlap.

**SEC-41 — Dependency and image scanning.** As the platform, I want known vulnerabilities blocked.
- AC: SCA and container scans run in CI; high/critical findings block release; lockfiles are committed; a documented patch SLA exists (critical ≤ 7 days).

**SEC-42 — Least-privilege infrastructure.** As the platform, I want a breach contained.
- AC: separate database roles for app, migration, read-only reporting; no shared superuser; network segmentation so the database and Redis are not internet-reachable; per-service credentials.

**SEC-43 — Security monitoring and alerting.** As the platform, I want attacks noticed quickly.
- AC: alerts for auth-failure spikes, refresh reuse, OTP abuse, admin anomalies, 4xx/5xx spikes and webhook signature failures; logs retained per policy and access-controlled.

**SEC-44 — Backups and recovery.** As the platform, I want data loss bounded and backups safe.
- AC: encrypted, access-controlled backups; a restore is tested at least quarterly; backup access is audited.

**SEC-45 — Vulnerability disclosure and pen testing.** As a researcher, I want a safe reporting path; as the business, I want independent assurance.
- AC: `security.txt` and a disclosure policy are published; an external penetration test passes (no open high/critical) before launch and annually, and after major auth or payment changes.

### 2.9 Privacy rights

**SEC-46 — Export and deletion are authenticated and safe.** As a member, I want to exercise my rights without opening a new attack path.
- AC: export and deletion require step-up (SEC-07); the export archive is delivered via a signed, expiring link to the verified contact; deletion has a 30-day cooling-off with cancel, and notifies all contacts on file.

**SEC-47 — Admin processing of privacy requests.** As an admin, I want a controlled workflow for DPDP requests.
- AC: requests are queued with SLA; identity is verified before action; every step is audited; the exported archive excludes other members' PII.

## 3. Security test requirements

- **Authorization matrix:** generated from the route table; every endpoint × role × ownership case asserts 401/403/404/200 as specified. A missing row fails CI.
- **Negative tests:** each story's AC includes at least one failing-path test (wrong token, expired OTP, replayed webhook, oversized upload, forged signed URL).
- **Static and dependency analysis:** SAST, secret scan, SCA and container scan on every PR.
- **Dynamic testing:** an automated DAST pass (OWASP ZAP baseline) against the staging PWA and API in CI nightly.
- **Header/CSP test:** automated assertion of SEC-28 on both apps.
- **Pen test:** scope covers auth, authorization, uploads, payments, chat and admin; findings tracked to closure.

## 4. Release gates (security)

A release is blocked by any of: a failing authorization matrix or missing row; an open high/critical vulnerability; a secret-scan hit; a failed header/CSP check; a missing audit entry for a covered action; or payment, verification or privacy changes without recorded security sign-off.

## 5. Phase mapping

| Phase | Security stories |
|---|---|
| MVP (Phase 1) | SEC-01 to SEC-07, SEC-09 to SEC-16, SEC-18 to SEC-23, SEC-25 to SEC-31, SEC-34, SEC-37, SEC-40 to SEC-42, SEC-44, SEC-46, SEC-47 |
| Phase 2 | SEC-08, SEC-17, SEC-24, SEC-32, SEC-33, SEC-35, SEC-36, SEC-43, SEC-45 |
| Phase 3 | SEC-38, SEC-39 (before billing is enabled; build and test earlier behind the flag) |

SEC-24, SEC-43 and SEC-45 MUST be in place before public launch even though they are scheduled with Phase 2 engineering; they are launch prerequisites, not features.

## 6. Open items

- Regulator notification timelines and the named data protection contact depend on the legal workstream (see SPEC.md open question 10).
- Admin IP allowlisting policy depends on the hosting model.
- Choice of antivirus engine (ClamAV vs managed) is an infrastructure decision.
