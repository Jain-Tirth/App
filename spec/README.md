# Dhobi Matrimony — Specification Appendices

This folder contains the detailed appendices for `../SPEC.md`. Read `SPEC.md` first; it defines the product, the locked decisions and the canonical requirements. These files drill into individual domains.

## Reading order

1. `00-product-overview.md` — why the product exists and how success is measured.
2. `01-personas-journeys.md` — who uses it and what their end-to-end paths look like.
3. `02-onboarding-auth.md` — language, account creation, OTP, wizard and submission.
4. `03-profile-field-dictionary.md` — the complete field model, required/optional, visibility and edit rules.
5. `04-media-verification-approval.md` — photos, government ID, face match and admin approval.
6. `05-search-discovery-matching.md` — search, recommendations and compatibility.
7. `06-engagement-messaging.md` — interests, shortlists, notifications, chat and safety.
8. `07-horoscope-biodata.md` — horoscope data, Guna Milan and the biodata PDF.
9. `08-monetization-plans.md` — plans, entitlements, Razorpay and future store billing.
10. `09-admin-operations.md` — admin roles, queues, moderation and audit.
11. `10-non-functional.md` — security, privacy, i18n, accessibility, performance and PWA behaviour.
12. `11-api-data-contracts.md` — API conventions, endpoint catalogue and database changes.
13. `12-testing-strategy.md` — seams, test matrix, CI and release gates.
14. `13-roadmap.md` — MVP, Phase 2, Phase 3 and the Expo migration trigger.
15. `14-expo-migration.md` — how the PWA becomes an Expo app without a rewrite.
16. `15-security-stories.md` — threat model and the 47 security stories (SEC-01 to SEC-47) with acceptance criteria, tests, release gates and phase mapping.

## Conventions used in these documents

- **MUST / SHOULD / MAY** follow RFC 2119 intent: MUST is a release blocker, SHOULD is expected unless there is a documented reason, MAY is optional.
- **Required** means required for profile submission. **Optional** means it can be completed later without blocking submission.
- **Once** means the member may change the value a single time after first save; further changes need an admin override.
- **Public** means visible to any approved member subject to privacy settings. **Premium** means visible only to entitled members. **Private** means owner and authorised admins only.
- All prices are configuration data; no price appears in code or in a client bundle.
- All timestamps are ISO-8601 UTC; the client renders them in the member's locale and time zone.
- All identifiers are UUIDs unless explicitly described as a public profile ID.
- "Member" means an authenticated user. "Visitor" means an unauthenticated person. "Admin" means an authenticated back-office user.

## Status

This is a build-ready draft. `SPEC.md` lists the confirmed decisions and the few items still marked **open (TBD)**; those must be resolved before the phase that depends on them. The roadmap maps each item to the phase it affects.
