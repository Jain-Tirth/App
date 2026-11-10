# 13 — Roadmap

## 1. Principles

- Ship a trustworthy core first: verified onboarding, discovery and interests. Communication and monetisation follow once the trust loop works.
- Every phase ends with a usable product, not a half-built feature.
- Platform work (shared core, PWA shell, CI) happens before feature work so later phases do not rework foundations.
- No phase starts before the previous phase's exit criteria are met unless a dependency is explicitly parallelised.
- The Expo migration is a separate phase that starts only after the entire PWA (Phases 1–3) is complete; it does not gate launch.

## 2. Phase summary

| Phase | Theme | Duration (indicative) | Outcome |
|---|---|---|---|
| 0 | Foundations | 3–4 weeks | Shared core, PWA shell, CI, environments, taxonomy seed |
| 1 | MVP | 8–10 weeks | Register → verify → approve → browse/search → interest/shortlist |
| 2 | Communication and monetisation | 6–8 weeks | Chat, contact reveal, billing behind a disabled flag (launch trial free), biodata, notifications, who-viewed |
| 3 | Premium and cultural depth | 8–10 weeks | Video, Guna Milan, Elite/assisted, live events, referrals |
| 4 | Expo migration | 8–12 weeks | Native app reusing `packages/core`, store billing |

Durations assume a small team (2–4 engineers, 1 designer, 1 part-time QA/ops). They are planning aids, not commitments.

## 3. Phase 0 — Foundations

### Deliverables

- `packages/core` scaffold: API client, Zod schemas, types, formatters, validators, i18n resources, platform adapter interfaces.
- PWA shell in `UserWeb`: routing, layout, design tokens, manifest, service worker, offline shell, update prompt.
- i18n infrastructure with en/hi/gu and font loading.
- Backend module structure, configuration, OpenAPI generation, error envelope, request IDs.
- Database migration tooling, baseline migration and seed framework.
- Taxonomy seed: religions, communities, Dhobi/Rajaka sub-castes, gotras, languages, education levels, degrees, occupations, income ranges, countries/states/cities, interests, prompts.
- CI: lint, type-check, unit, API, build, contract, Playwright skeleton, Lighthouse skeleton.
- Environments: local, staging, production; secrets management; backups.
- Observability: structured logs, metrics, tracing, error tracking, dashboards.
- Admin shell: login, MFA, navigation, role scaffolding.

### Exit criteria

- A member can load the PWA, switch language, and see a placeholder onboarding screen.
- The API serves a health check and an OpenAPI document.
- CI runs end-to-end on a pull request.
- Staging deploys automatically from main.
- A seeded taxonomy loads in the app.
- Backups restore successfully in a drill.

## 4. Phase 1 — MVP

### Scope

**Onboarding and profile**

- Language selection and persistence.
- Registration with email/password/mobile, OTP verification, consent capture.
- Profile-created-for and manager fields.
- Full section-based onboarding: personal, religious, location, education, career, family, lifestyle, about/prompts/interests, preferences, contact, horoscope.
- Autosave, offline draft, resume, completion percentage.
- One-time-edit rules.
- Photos: upload, processing, moderation, primary selection, visibility.
- Government ID + member photo verification with manual admin review at launch; the provider adapter interface is retained for later automation.
- Submission gates, status state machine, withdraw/resubmit.

**Review and approval**

- Admin review queue, workspace, document comparison, approve/request changes/reject.
- Audit log and document access log.
- Member notifications for decisions.

**Discovery**

- Approved-only home recommendations (9/day).
- Search with core filters and cursor pagination.
- Profile detail with privacy and premium masking.
- Profile-ID search.
- Profile views and who-viewed-me data capture (display gated to Phase 2).

**Engagement basics**

- Send/accept/decline/withdraw interests.
- Named shortlists.
- Ignore/hide with undo.
- Block and report.

**Account and privacy**

- Settings: language, notification preferences (in-app), privacy defaults, logout-all, delete account, export request.
- PWA install prompt, offline banner, update prompt.

### Exit criteria

- A new member can complete the full journey from language selection to an approved profile with no manual database intervention.
- Admin can review and decide within the workspace; every decision is audited.
- Only approved profiles appear in discovery.
- Interests and shortlists work end-to-end.
- Contact details are never exposed to unauthorized members.
- PWA installs, works offline for drafts, and passes performance/accessibility budgets.
- API and PWA critical-path tests pass in CI.

### Not in Phase 1

Chat, contact reveal, billing UI/checkout, biodata, who-viewed-me display, video, Guna Milan, Elite.

## 5. Phase 2 — Communication and monetisation

### Scope

**Messaging**

- Conversations with server-enforced eligibility.
- Socket.io real-time delivery, read receipts, typing.
- Message history, mute, delete, report/block from chat.
- Abuse scanning, rate limits, contact-info detection.
- Push notifications (Web Push) with SMS/email fallback.

**Monetisation (built now, switched off at launch)**

- Plans, prices, entitlements (Free/Prime) and a single `EntitlementService`.
- `billingEnabled=false` during the launch trial: every gated capability resolves to allowed and no paywall or checkout is shown.
- Razorpay orders, checkout, verification, webhooks and reconciliation are implemented behind the flag and tested with fakes.
- Membership lifecycle, invoices, GST, refunds, cancellation and renewal reminders are ready for switch-on.
- Admin plan/price management, grants, refunds and revenue dashboards.

**Premium discovery**

- Reverse matches, new matches, online now.
- Who-viewed-me display.
- Saved searches.
- Advanced filters (income, education, occupation).
- Compatibility score and explanations.

**Biodata**

- Server-side PDF generation with en/hi/gu fonts.
- Templates, preview, download, share.
- Watermark, signed URLs, caching.

**Notifications**

- Full event catalogue, preferences per channel, quiet hours, digests.
- Admin broadcast and delivery dashboard.

**Operations**

- Support tickets with SLAs and canned responses.
- Photo/report queues with evidence and enforcement.
- Feature flags, maintenance mode, minimum version.
- Taxonomy admin UI.
- DPDP export/deletion workflow.

### Exit criteria

- Two members can match, unlock chat, converse in real time and reveal contact according to entitlement.
- When `billingEnabled` is turned on, a member can purchase Prime via Razorpay and immediately access locked features; webhooks and reconciliation are verified.
- Refund, cancellation and renewal flows work.
- Biodata renders correctly in all three languages.
- Notifications deliver on all channels with fallbacks.
- Support and moderation queues are operational.
- All Phase 1 tests still pass; new payment, chat and privacy tests pass.

## 6. Phase 3 — Premium and cultural depth

### Scope

**Horoscope matching**

- Full chart computation with an isolated engine and reference fixtures.
- 36-point Guna Milan with explanations and dosha notes.
- Premium horoscope detail and filters.

**Video and events**

- Agora video calling for mutual matches.
- Live virtual events with moderation.

**Elite / Assisted**

- Relationship manager workspace.
- Curated introductions and consent tracking.
- Meeting scheduler and notes.
- Priority support.

**Growth**

- Referrals and invite tracking.
- Success stories with consent.
- Promotions and coupons.
- A/B testing framework for ranking and paywalls.

**Depth**

- Email verification and mobile+OTP login.
- Ownership transfer for parent-managed profiles.
- Data-driven ranking improvements.
- Advanced analytics and cohort dashboards.

### Exit criteria

- Guna Milan matches reference charts and is explained in all languages.
- Video calls work on supported browsers with consent and safety controls.
- Elite members receive curated introductions through the RM workspace.
- Referrals and promotions are measurable.
- No regression in trust, privacy or payment behaviour.

## 7. Phase 4 — Expo migration

Detailed plan in `14-expo-migration.md`.

### Scope

- Expo React Native app consuming `packages/core`.
- Native adapters: secure storage, camera, push (FCM/APNs), share, deep links, biometrics.
- Store billing (Apple/Google) and RevenueCat integration.
- Native KYC/liveness SDK where beneficial.
- Store listings, review, staged rollout.

### Exit criteria

- Feature parity with the completed PWA for all member-facing journeys.
- Entitlements restore across web and native.
- Push, camera, deep links and payments work on both platforms.
- Crash-free sessions ≥ 99.5% in the rollout cohort.
- The PWA remains supported during and after migration.

## 8. Dependencies and sequencing

| Workstream | Depends on |
|---|---|
| Onboarding | Auth, taxonomy, media, verification |
| Review/approval | Onboarding, admin auth, audit |
| Discovery | Approved profiles, scoring, taxonomy, indexes |
| Interests/shortlists | Discovery |
| Chat | Interests (mutual match), entitlements, notifications |
| Payments | Plans, entitlements, auth, webhooks |
| Biodata | Profile data, fonts, horoscope, PDF renderer |
| Guna Milan | Horoscope data, engine |
| Video | Chat, entitlements, Agora |
| Elite | Payments, RM tooling, chat |
| Expo | Entire PWA (Phases 1–3) complete, shared core, native adapters |

## 9. Resolved decisions and remaining open questions

| # | Question | Decision | Phase impact |
|---|---|---|---|
| 1 | Dhobi/Rajaka sub-caste seed list | **Resolved:** supplied later and seeded into the database through a versioned seed. Taxonomy, stable codes and admin management are built now. | Phase 0 seed, Phase 1 onboarding/search |
| 2 | INR price points, durations, free trial | **Resolved for launch:** all features free during the launch trial; billing stays modular behind `billingEnabled` and configuration. INR prices needed before switch-on. | Phase 2 payments |
| 3 | Age policy | **Resolved:** men 21+, women 18+. | Phase 1 age gate and ID check |
| 4 | KYC provider and cost ceiling | **Resolved for launch:** manual admin verification of member photo and ID proof; `ManualKycProvider` default, managed provider later. | Phase 1 verification |
| 5 | Retention durations | **Resolved:** 24-month retention/consent cycle, then re-consent; versioned consent records with exact text, name, IP and timestamp; statutory retention overrides. | Phase 1 privacy policy, Phase 2 deletion |
| 6 | Review staffing and SLA hours | **Open (TBD):** assume one reviewer per shift and calendar-hour SLA. | Phase 1 approval promise |
| 7 | Biodata availability | **Resolved:** only after admin approval. | Phase 2 biodata |
| 8 | Chat gating rule | **Open (TBD):** keep `chat.requireMutualMatch` and `chat.requirePrime` configuration; default mutual + Prime on at least one side. | Phase 2 chat |
| 9 | Moderation policy for family/pre-wedding photos | **Open (TBD):** default to the normal moderation queue with a manual decision; policy is admin configuration. | Phase 1 photo moderation |
| 10 | Grievance officer, legal entity, notices | **Open (TBD):** placeholders until legal details are supplied. | Phase 1 launch compliance |
| 11 | VAPID ownership and iOS fallback policy | **Resolved:** platform owns one key pair per environment in the secret manager, rotates with overlap; push is best-effort with in-app plus SMS/email fallback for critical events on non-installed iOS. | Phase 2 push |
| 12 | Expo migration trigger | **Resolved:** after the entire PWA (Phases 1–3) is complete. | Phase 4 |

## 10. Release gates per phase

| Phase | Gate |
|---|---|
| 0 | CI green; staging deploy; backup restore drill; taxonomy review |
| 1 | Full onboarding→approval journey; authorization matrices; PWA budgets; privacy review |
| 2 | Payment and chat end-to-end; webhook/reconciliation; refund; notification fallbacks; support runbook |
| 3 | Guna Milan fixtures; video safety; Elite consent; referral attribution |
| 4 | Native parity; store review; entitlement restore; crash-free threshold |

## 11. Critical path

```
Foundations
  → Auth + taxonomy + media + verification
  → Onboarding + submission
  → Admin review + approval
  → Discovery + search
  → Interests + shortlists
  → Notifications
  → Chat + entitlements
  → Payments
  → Biodata + who-viewed + advanced discovery
  → Guna Milan + video + Elite
  → Expo
```

Any delay in taxonomy, verification or approval pushes every later phase. These three are the highest-risk items and should be de-risked first.

## 12. Acceptance checklist

- [ ] Each phase has a usable outcome and measurable exit criteria.
- [ ] Foundations precede feature work.
- [ ] Dependencies are explicit and respected.
- [ ] Resolved decisions and remaining open questions are mapped to the phase they affect.
- [ ] No phase requires a rewrite of the previous one.
- [ ] The Expo migration is separate and does not gate launch.
