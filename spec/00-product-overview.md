# 00 — Product Overview

## 1. Vision

A trusted matrimony platform built specifically for the Dhobi/Rajaka community, where every profile is verified, every family's cultural expectations are respected, and every conversation starts with consent.

## 2. Mission

Help marriage-minded members and their families find compatible partners without the noise, fake profiles and privacy risks of general-purpose platforms. We do this through:

- community-accurate profiles (sub-caste, gotra, horoscope, family);
- mandatory identity and photo verification;
- privacy-first contact sharing;
- a calm, mobile-first experience in the member's own language.

## 3. Positioning

| Dimension | General matrimony apps | Dhobi Matrimony |
|---|---|---|
| Community fit | Broad, generic taxonomies | Dhobi/Rajaka sub-castes, gotra, regional variants |
| Trust | Optional or paid verification | Verification required before visibility |
| Privacy | Contact often exposed early | Contact hidden by default, per-field control |
| Language | English-first | English, Hindi, Gujarati from day one |
| Family involvement | Treated as an edge case | First-class "profile created for" and family sections |
| Experience | App-store app | Installable PWA now, native later |

## 4. Target market

- **Primary:** Dhobi/Rajaka community members in India, marriage-minded, smartphone-first, comfortable with UPI and WhatsApp. Women must be 18+, men 21+.
- **Secondary:** Parents and relatives (45–65) creating and managing profiles on behalf of their children.
- **Tertiary:** NRI/diaspora members from the community in the Gulf, UK, US, Canada and Australia.
- **Geographic launch focus:** Gujarat, Maharashtra, Telangana, Andhra Pradesh and Madhya Pradesh, where the community has a strong presence. Expand based on demand.

## 5. Platform map

| Surface | Technology | Responsibility |
|---|---|---|
| Member PWA | React + Vite + Tailwind in `UserWeb`, service worker, manifest | Onboarding, profile, discovery, interests, chat, membership |
| Public web | Same build, marketing routes | Landing, community story, success stories, legal, help, app install |
| API | NestJS + PostgreSQL + Redis + BullMQ | Identity, profiles, verification, matching, messaging, billing, notifications |
| Admin panel | React + Vite in `AdminPanel` | Review, verification, moderation, support, taxonomy, analytics |
| Object storage | S3-compatible | Photos, ID documents, biodata PDFs, chat media |
| Future mobile | Expo React Native | Native app after the entire PWA (Phases 1–3) is complete; reuses `packages/core` |

## 6. Product principles

1. **Verified by default.** No profile is discoverable until identity, photo and admin review pass.
2. **Consent before contact.** Members control who sees their number, email and photos.
3. **Community accuracy over volume.** A smaller, correct taxonomy beats a broad, wrong one.
4. **One job per screen.** Onboarding is long; each step asks for one coherent set of facts.
5. **Explain every match.** Members should understand why a profile is recommended.
6. **No dark patterns.** Prices, renewals, locks and limits are stated plainly.
7. **Mobile-grade quality.** Fast, thumb-friendly, resilient on poor networks.
8. **Build once, port later.** Domain logic and API contracts live outside the web UI.
9. **Safety is a feature.** Report, block, moderation and audit are part of the core, not an afterthought.
10. **Operable by a small team.** Admin workflows, feature flags and configuration replace custom code.

## 7. Success metrics

### North star

**Weekly verified active profiles that receive or send at least one meaningful interaction (interest, acceptance or message).**

### Activation funnel

| Stage | Metric | Target (first 6 months) |
|---|---|---|
| Visit → registration start | Registration start rate | ≥ 25% |
| Registration start → OTP verified | OTP completion | ≥ 80% |
| OTP verified → profile submitted | Onboarding completion | ≥ 55% |
| Submitted → approved | Approval rate | ≥ 85% |
| Approved → first interest sent/received within 7 days | Activation | ≥ 60% |
| Approved → Prime conversion within 30 days | Monetisation | ≥ 6% |

### Quality and trust

- Median profile review time ≤ 24 hours; 95th percentile ≤ 48 hours.
- ID verification auto-pass rate ≥ 70%; manual-review rate ≤ 25%; false-reject rate ≤ 2%.
- Reported-profile rate < 1% of monthly active profiles.
- Report first-response time < 12 hours.
- Contact-detail complaints (unsolicited contact) trending down month over month.

### Engagement

- Daily recommendations viewed per active member ≥ 5.
- Interest acceptance rate ≥ 25%.
- Mutual-match to first-message rate ≥ 40%.
- 30-day member retention ≥ 35%.
- 90-day retention ≥ 20%.

### Commercial

- Prime conversion ≥ 6% of approved members within 30 days.
- Refund rate < 3%.
- Payment success rate ≥ 95% for Razorpay.
- CAC payback within 6 months (once paid acquisition begins).

### Technical

- API p95 latency < 300 ms for reads, < 500 ms for search.
- PWA Lighthouse performance ≥ 85 on mid-tier Android; installability 100%.
- Crash-free sessions ≥ 99.5%.
- Availability ≥ 99.9% monthly.

## 8. Phase summary

| Phase | Theme | Outcome |
|---|---|---|
| Phase 0 | Foundations | Shared core, PWA shell, CI, environments, taxonomy seed |
| Phase 1 (MVP) | Verified onboarding and discovery | Register → complete profile → verify → approve → browse/search → interest/shortlist |
| Phase 2 | Communication and monetisation | Chat, contact reveal, billing behind a disabled flag (launch trial free), biodata PDF, notifications, who-viewed |
| Phase 3 | Premium and cultural depth | Video, Guna Milan, assisted tier, live events, referrals, analytics |
| Phase 4 | Native migration | Expo app reusing `packages/core`; store billing; native KYC/push |

## 9. Non-goals for launch

- App-store presence and in-app purchases (Expo phase).
- Video and live events (Phase 3).
- Horoscope matching beyond display and filters (Phase 3).
- Communities outside the Dhobi/Rajaka Hindu focus.
- Wedding services, commerce or astrology marketplaces.

## 10. Constraints

- Small team; favour managed services and configuration over custom infrastructure.
- India-first payments, SMS and KYC; low-bandwidth and low-end Android support.
- DPDP Act 2023 compliance from day one.
- PWA limitations on iOS (push, liveness) mitigated with fallbacks.
- No vendor lock-in for KYC, payments or storage; adapters are mandatory.
