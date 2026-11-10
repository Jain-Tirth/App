# 10 — Non-Functional Requirements

These requirements are acceptance criteria, not polish. A release that violates a MUST here is blocked regardless of feature completeness.

## 1. Security

### 1.1 Authentication

- Passwords hashed with bcrypt (cost ≥ 12) or argon2id; never logged or returned.
- Access tokens are short-lived JWTs (15 minutes) held in memory on the client.
- Refresh tokens are opaque, rotating, hashed at rest, `HttpOnly`, `Secure`, `SameSite=Strict` cookies for the PWA.
- Refresh-token reuse detection revokes the whole session family and alerts the member.
- OTPs are single-use, hashed at rest, expire in 5 minutes and are rate-limited per mobile and IP.
- Admin authentication is separate, MFA-mandatory and shorter-lived.
- Optional biometric unlock on supported devices is a local convenience gate, never a server authentication factor.

### 1.2 Authorization

- Every endpoint enforces authentication, role and ownership checks server-side.
- The API never trusts a client-supplied user ID for identity.
- Object-level authorization is tested for every resource (profiles, photos, documents, conversations, orders, tickets).
- Admin permissions are explicit; UI hiding is not authorization.
- Service-to-service calls use scoped credentials, not a shared superuser.

### 1.3 Data protection

- TLS 1.2+ everywhere; HSTS with a long max-age.
- Encryption at rest for the database, object storage and backups.
- Field-level encryption for ID numbers, contact details and message content where required.
- ID numbers are masked in every read model; full values are admin-only and audited.
- Media is private by default and served through short-lived signed URLs (5–15 minutes).
- Secrets live in a managed secret store; no secrets in the repo or client bundles.
- PII is excluded from logs, analytics, error trackers and push payloads.
- Database access is least-privilege; migrations use a separate role.

### 1.4 Application security

- Input validation at the API boundary (schema validation) and output encoding in the UI.
- Parameterised SQL only; no string-built queries.
- CSRF protection for cookie-based endpoints; state-changing calls use bearer tokens.
- SSRF protection for URL fetching; allowlist outbound hosts.
- File upload validation by content, not just extension; virus scanning before processing.
- Rate limits on auth, OTP, search, interests, messages, uploads and payments.
- Security headers: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame restrictions.
- Dependency and container scanning in CI; high/critical vulnerabilities block release.
- A vulnerability disclosure path and a documented incident response plan.
- Penetration test before launch and annually; retest after major auth or payment changes.

### 1.5 Abuse prevention

- Device/IP velocity limits on registration and OTP.
- Perceptual-hash duplicate photo detection.
- Duplicate ID-number detection routed to review.
- Contact-info detection in chat and bios.
- Report/block controls and automatic throttles on repeated reports.
- Bot mitigation on public forms (CAPTCHA after suspicious behaviour, not by default).

## 2. Privacy and DPDP compliance

### 2.1 Principles

- Lawful purpose, consent, data minimisation, storage limitation and accountability.
- Collect only what the product needs; optional fields are clearly optional.
- Explain why sensitive data (ID, horoscope, special cases) is collected and who can see it.
- Consent is explicit, unbundled, versioned, timestamped and revocable.
- Members can access, correct, export and delete their data.
- Children/minors are not permitted; age is verified against a government ID.

### 2.2 Consent

| Consent | Required | Revocable |
|---|---|---|
| Terms of use | Yes | Account deletion |
| Privacy policy | Yes | Account deletion |
| Government ID processing | Yes | Account deletion; withdrawal blocks verification |
| Marketing communications | No | Yes, anytime |
| WhatsApp contact display | No | Yes |
| Analytics (if non-essential) | No | Yes |

- Consent records store the consent code, document version and hash, the exact text shown, user name, IP, user agent, grant timestamp, expiry (24 months by default), source and revocation timestamp.
- Consent is versioned: a change to the text creates a new version; existing records keep the exact text the member accepted.
- The current consent documents are seeded and served by the API. At 24 months the member is prompted to re-consent; declining triggers the documented consequence.
- Withdrawing consent that is required for the service triggers the documented consequence, not a silent failure.

### 2.3 Data subject rights

- **Access/export:** machine-readable archive within 30 days; identity verified.
- **Correction:** profile editing plus support-assisted correction for one-time fields.
- **Deletion:** deactivation immediately; PII deleted or anonymised after a 30-day cooling-off; financial and audit records retained as legally required.
- **Grievance:** named grievance officer, contact details in the app and on the website, response within statutory timelines.
- **Nomination:** where applicable under DPDP, a process to nominate a person to exercise rights.

### 2.4 Retention

| Data | Retention |
|---|---|
| Active account profile | Until deletion |
| ID images | 24 months after decision (configurable) |
| Member photo / selfie | 24 months after decision |
| Manual or automated verification results | 24 months |
| Rejected photos | 30 days |
| Messages | 24 months after last activity |
| Notifications | 24 months |
| OTP logs | 24 months (hashed, no code) |
| Audit logs | 24 months, or longer where law requires |
| Payment records | 7+ years (statutory) |
| Deleted account PII | Purged after cooling-off |
| Consent records | 24 months from grant, then re-consent; statutory retention overrides |
| Analytics | Aggregated or pseudonymised after 24 months |

- At the end of the 24-month window the member is asked to re-consent through the API. If they decline, verification and visibility stop and deletion is scheduled.
- Retention jobs run daily, report failures, and are visible on a compliance dashboard.
- Legal hold overrides retention with an explicit, audited flag.

### 2.5 Breach response

- Documented playbook: detect, contain, assess, notify, remediate, review.
- Member notification without undue delay where required.
- Regulator notification within statutory timelines.
- Post-incident review and corrective actions tracked to closure.

## 3. Internationalization (i18n)

### 3.1 Languages

- Launch: English (`en`), Hindi (`hi`), Gujarati (`gu`).
- All UI strings, validation messages, emails, SMS, push notifications, PDF labels and admin member-facing templates are externalised.
- No hardcoded user-facing strings in components or API responses.
- User-generated content is never translated.
- Language is stored per account and per device before login.

### 3.2 Implementation

- Translation resources are structured JSON with namespaced keys, not flat blobs.
- ICU MessageFormat for plurals, gender, counts, dates and numbers.
- Missing keys fall back to English and fail CI in strict mode for launch languages.
- Dates, times, numbers and currency use `Intl` with the member's locale and time zone.
- Fonts: Noto Sans, Noto Sans Devanagari and Noto Sans Gujarati, subset and preloaded for the PWA; embedded for PDFs.
- Layout tolerates 30–40% string expansion; no fixed-width buttons that clip translations.
- Language switcher is available before login and in Settings; switching never loses form state.
- Admin Panel is English at launch; member-facing templates are multilingual.
- SMS uses the GSM-7/UCS-2 aware segment budget; long Hindi messages are split safely or shortened.

### 3.3 RTL readiness

Launch languages are LTR. CSS uses logical properties (`margin-inline`, `padding-inline`) so a future RTL language does not require a rewrite.

## 4. Accessibility

- Target **WCAG 2.1 AA**.
- Semantic landmarks, headings and lists; one `h1` per screen.
- Every control has an accessible name; icon-only buttons have labels.
- Visible focus indicators; logical tab order; no keyboard traps.
- Colour contrast ≥ 4.5:1 for text, ≥ 3:1 for large text and UI components.
- Errors are announced and linked to fields; not colour-only.
- Text scales to 200% without loss of content or function.
- Touch targets ≥ 44×44 CSS px.
- Motion respects `prefers-reduced-motion`; no autoplay video.
- Images have alt text; decorative images are hidden from assistive tech.
- Forms use native inputs where possible; OTP inputs support paste and autofill.
- Screen-reader testing on Android TalkBack and iOS VoiceOver for critical flows.
- Automated axe checks run in CI on changed screens; manual audit before launch.

## 5. Performance

### 5.1 Budgets

| Metric | Target |
|---|---|
| LCP (mid-tier Android, 4G) | ≤ 2.5 s |
| INP | ≤ 200 ms |
| CLS | ≤ 0.1 |
| TTFB (API, p95) | ≤ 300 ms reads |
| Search API p95 | ≤ 500 ms |
| Profile detail API p95 | ≤ 300 ms |
| Chat message delivery p95 | ≤ 500 ms in-app |
| JS initial bundle (gzip) | ≤ 200 KB |
| Route chunk (gzip) | ≤ 100 KB |
| Lighthouse performance | ≥ 85 mobile |
| Lighthouse PWA installability | 100% |

### 5.2 Techniques

- Route-level code splitting; lazy-load heavy screens (chat, biodata, admin).
- Responsive images with `srcset`, WebP/AVIF, width/height attributes and lazy loading.
- CDN for static assets and media; cache-control with content hashes.
- Server-side compression (Brotli) and HTTP/2+.
- Virtualised lists for search and chat.
- Skeleton states instead of spinners for content; no layout shift.
- Debounced search input; cancel stale requests.
- Pagination and cursor limits; no unbounded queries.
- Redis caching for taxonomy, facets and recommendations.
- Database indexes on all filter and sort columns; `EXPLAIN` review for new queries.
- Load tests for search, recommendations, chat and payments before launch.

## 6. Reliability and availability

- Target availability: **99.9% monthly** for the API and PWA shell.
- Stateless API behind a load balancer; health and readiness endpoints.
- Postgres with automated backups, point-in-time recovery and a tested restore.
- Redis persistence for queues; BullMQ retries with backoff and dead-letter queues.
- Idempotency for payments, submissions, uploads and notifications.
- Graceful degradation:
  - KYC provider down → manual review queue.
  - Payment provider down → clear message, no lost orders.
  - SMS down → email OTP fallback.
  - Push down → in-app notification centre.
  - Object storage down → retryable upload errors and preserved local drafts.
  - Search degraded → fall back to recommendation feed.
- Maintenance mode and feature kill switches.
- Documented runbooks for incidents, deploys, rollbacks and data restore.
- RPO ≤ 15 minutes; RTO ≤ 4 hours.

## 7. Observability

- Structured JSON logs with request ID, user pseudonymous ID, route, status and latency.
- No PII, tokens, OTPs, passwords, document numbers or message content in logs.
- Distributed tracing across API, workers and external providers.
- Metrics: request rate, error rate, latency percentiles, queue depth, job failures, provider latency, payment success, notification delivery.
- Alerts for error-rate spikes, p95 latency, queue backlog, SLA breaches, payment failures, verification failure spikes and backup failures.
- Dashboards for product and operations (see `09`).
- Error tracking with release and source-map association.
- Audit logs are separate from application logs and are immutable.

## 8. PWA-specific requirements

### 8.1 Installability

- Web app manifest with name, short name, description, start URL, scope, display `standalone`, theme/background colours, 192/512 icons, maskable icon and screenshots.
- Served over HTTPS with a valid service worker and offline start URL.
- Install prompt shown contextually after onboarding; dismissal respected for 30 days.
- Installed mode detected; UI adapts (no browser-only affordances).

### 8.2 Offline

- App-shell precache with versioned cache names.
- Offline fallback page with retry.
- Profile drafts persisted to IndexedDB on change and restored on reload.
- Explicit offline banner; queued idempotent saves replay once on reconnect.
- No offline access to other members' private data; cached responses are scoped and expire.
- Cache-first for static assets, network-first for API reads, no caching of authenticated mutation responses.
- Logout clears caches, IndexedDB drafts and push subscriptions.

### 8.3 Updates

- Service worker uses `skipWaiting` only after a member confirms.
- "Update available" prompt when a new version is detected.
- No silent reload while a form is dirty.
- Minimum-supported-version gate shows a blocking update screen for critical versions.
- Stale clients are detected via an API version header and guided to refresh.

### 8.4 Push

- VAPID keys rotated with overlap; subscriptions re-registered on rotation.
- `pushsubscriptionchange` handled; expired subscriptions pruned.
- Permission requested only after a member action, with an explanation.
- Push payloads contain no sensitive content.
- iOS fallback: in-app centre plus SMS/email for critical events.

### 8.5 Browser support

- Last two versions of Chrome, Edge, Safari, Firefox on desktop.
- Chrome Android, Samsung Internet, Safari iOS 16.4+ (install/push), iOS 15+ (basic).
- Graceful degradation: no camera → file upload; no share API → download; no push → in-app.
- Automated checks on Chromium and WebKit; manual device matrix before release.

## 9. SEO and marketing

- Public marketing pages are server-rendered or prerendered with correct metadata, Open Graph tags and canonical URLs.
- Member profiles and app screens are `noindex` and blocked from crawlers.
- Sitemap for public pages; robots policy excludes private routes.
- Structured data for the organisation and FAQ where appropriate.
- Deep links use stable URLs with sensible previews; private content requires auth.

## 10. Rate limits and quotas

| Surface | Limit (default) |
|---|---|
| Registration per IP | 10/hour |
| OTP per mobile | 10/day |
| OTP verify attempts | 5/code |
| Login attempts | 10/hour per account, then CAPTCHA/lockout |
| Search requests | 60/minute per member |
| Profile views | 300/day per member |
| Interests sent | 50/day free, 150/day Prime |
| Messages | 30/minute, 200/hour per sender |
| New conversations | 10/day free, 60/day Prime |
| Contact reveals | 10/day free grace, 50/day Prime |
| Media uploads | 30/day per member |
| Reports | 10/day per member |
| Payment orders | 5/hour per member |
| Admin export | 5/day per admin |

Limits are configuration, return `429` with `Retry-After`, and are enforced at the edge and in the service.

## 11. Data quality and integrity

- Database constraints for uniqueness, foreign keys, enums and ranges.
- Migrations are forward-only, reviewed and reversible where feasible.
- Stored functions are versioned and covered by API tests.
- Soft delete only where recovery or audit requires it; otherwise hard delete.
- Clock skew handled with server timestamps; clients never supply authoritative times.
- Money uses integer minor units; never floats.
- Time zones stored as UTC; display in the member's zone.
- Unicode normalisation for names and free text; trim before validation.

## 12. Compliance and legal

- Terms of use, privacy policy, refund policy and community guidelines published and versioned.
- Grievance officer and contact details visible in-app and on the website.
- GST registration and invoices where applicable.
- Payment and KYC providers are contracted with appropriate data-processing terms.
- Age gate and ID verification support compliance with Indian marriage law.
- Accessibility statement published.
- Cookie/tracking disclosure where non-essential analytics are used.

## 13. Acceptance checklist

- [ ] Authorization tests exist for every role and resource.
- [ ] Tokens, OTPs and PII never appear in logs or analytics.
- [ ] ID numbers are masked; media uses signed URLs.
- [ ] Consent is explicit, versioned and recorded.
- [ ] Export and deletion flows meet the stated timelines.
- [ ] Retention jobs run and report status.
- [ ] All launch strings are translated; missing keys fail CI.
- [ ] Devanagari and Gujarati render correctly in UI and PDFs.
- [ ] WCAG 2.1 AA checks pass on critical flows.
- [ ] Performance budgets pass on a mid-tier Android profile.
- [ ] The PWA installs, works offline for drafts, and updates safely.
- [ ] Push works where supported and falls back elsewhere.
- [ ] Rate limits return `429` with `Retry-After`.
- [ ] Backups restore successfully in a drill.
- [ ] Alerts fire for error, latency, queue and payment anomalies.
- [ ] Member profiles are not indexable.
