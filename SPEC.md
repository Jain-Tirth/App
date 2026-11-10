# Dhobi Matrimony — Product Specification

**Document status:** Draft for agent execution
**Version:** 1.0
**Date:** 9 November 2026
**Product:** Dhobi Matrimony (working name)
**Tagline:** Tradition • Trust • Togetherness
**Scope:** Entire product — MVP, Phase 2 and Phase 3, delivered as a PWA first
**Sources:** `Shaadi_Feature_Reference.pdf`; the 8 onboarding/profile reference screenshots in `application/application/`; the existing `Backend`, `AdminPanel` and `UserWeb` codebases; `Dhobi_Matrimony_Complete_Plan.md`; `ArchitectureBlueprint.md`.

---

## How to read this spec

`SPEC.md` is the canonical specification and follows the standard spec template. The `spec/` folder contains the detailed appendices that this document references. When the two disagree, `SPEC.md` wins; when an appendix is more specific, the appendix wins for that topic.

| File | Contents |
|---|---|
| `spec/00-product-overview.md` | Vision, market, differentiators, platform map, success metrics |
| `spec/01-personas-journeys.md` | Personas and end-to-end journeys |
| `spec/02-onboarding-auth.md` | Language, registration, OTP, onboarding wizard, submission |
| `spec/03-profile-field-dictionary.md` | Every profile field, type, required/optional, visibility, edit rules |
| `spec/04-media-verification-approval.md` | Photo pipeline, government ID verification, admin approval |
| `spec/05-search-discovery-matching.md` | Search, filters, recommendations, compatibility and ranking |
| `spec/06-engagement-messaging.md` | Interests, shortlists, ignore, notifications, chat, safety |
| `spec/07-horoscope-biodata.md` | Horoscope capture, Kundli, Guna Milan, biodata PDF |
| `spec/08-monetization-plans.md` | Free/Prime/Elite plans, entitlements, Razorpay, future store billing |
| `spec/09-admin-operations.md` | Admin roles, review queue, moderation, audit, analytics, support |
| `spec/10-non-functional.md` | Security, DPDP privacy, i18n, accessibility, performance, reliability |
| `spec/11-api-data-contracts.md` | API conventions, endpoint catalogue, schema changes, integrations |
| `spec/12-testing-strategy.md` | Test seams, what to test, prior art, environments, CI |
| `spec/13-roadmap.md` | MVP / Phase 2 / Phase 3 sequencing, dependencies, release gates |
| `spec/14-expo-migration.md` | Planned PWA → Expo React Native migration |

---

## Decisions locked for this specification

| Area | Decision |
|---|---|
| Launch platform | **Mobile-first PWA** built in the existing `UserWeb` React + Vite codebase. Installable, offline-capable, responsive from 320 px up. |
| Later platform | **Expo (React Native + TypeScript)** migration after the entire PWA (Phases 1–3) is complete. Not part of the launch scope. See `spec/14-expo-migration.md`. |
| Backend | Keep the existing **NestJS + PostgreSQL** service, extended with new modules, migrations and stored functions. No rewrite. |
| Admin | Keep the existing **React + Vite AdminPanel**, extended for profile, ID, photo, moderation and operations workflows. |
| Audience | **Dhobi / Rajaka community, Hindu-focused**, with Dhobi sub-caste taxonomy seeded as reference data. |
| Languages | **English, Hindi, Gujarati** at launch. All strings externalised for future languages. |
| Business model | **Freemium.** Free registration and browsing; **Prime** unlocks contact details, chat and premium discovery. **Elite/Assisted** in Phase 3. |
| Payments | **Razorpay web checkout** at launch. Apple/Google store billing and RevenueCat arrive with the Expo migration. |
| Profile depth | Full field set from the reference screenshots, with mandatory vs optional explicit. |
| Trust and safety | OTP, government ID + face/liveness verification, admin approval, status state machine, DPDP consent and retention. |
| Architecture | Modular monolith with stateless HTTP API, Redis, BullMQ workers, S3-compatible object storage, Socket.io, OpenAPI contract. |
| Code sharing | Framework-agnostic domain/API layer in `packages/core`, consumed by the PWA now and by Expo later. Web-only UI stays in `UserWeb`. |
| Delivery model | Spec written to repo files (no external issue tracker is configured). |

### Why PWA first

- The product is already a React + Vite + Tailwind application, so the PWA reuses the existing screens, router and design tokens.
- Members can start using the product immediately through a link, with no app-store review cycle or install friction.
- A PWA covers Android, iOS, desktop and low-end devices from one codebase, which matters for a community product with mixed device quality.
- The PWA is the fastest way to validate onboarding, verification, discovery and willingness to pay before committing to native builds.
- The architecture deliberately isolates platform capabilities and domain logic, so the Expo app later replaces the UI layer rather than the product.

### PWA constraints accepted for launch

| Constraint | Impact | Mitigation |
|---|---|---|
| iOS push only works for installed home-screen PWAs (16.4+) | Some iOS members miss push | In-app notification centre, SMS/email for critical events, clear install prompt |
| Strong liveness detection is limited in a browser | Higher spoof risk | Hosted KYC web flow, selfie challenge, manual review fallback, face-match scoring |
| No app-store distribution | Less discoverability | Installable PWA, deep links, marketing site, store listings in the Expo phase |
| No store billing | Only Razorpay at launch | Razorpay covers cards, UPI, netbanking and wallets in India |
| Background sync is unreliable on iOS | Offline saves may wait | Save on focus/visibility, explicit retry, IndexedDB drafts |
| Camera quality varies by browser | Poor document captures | Capture guidance, file upload fallback, re-capture prompts |
| Service worker cache can go stale | Members see old UI | Versioned cache, update prompt, skip-waiting flow |

### Confirmed decisions and remaining assumptions

1. **Age policy — confirmed:** men must be at least 21, women at least 18. Both minimums are configuration values, enforced server-side and re-checked during ID verification.
2. **KYC — confirmed:** verification is manual by an admin at launch. The member selects/uploads a photo and enters/uploads government ID proof; an admin compares them and approves or rejects. The `KycProvider` interface stays so a managed provider (HyperVerge, Signzy, IDfy or Rekognition) can be added later without changing the workflow. No third-party OCR/face-match cost at launch.
3. **Video:** Agora Web SDK is the default recommendation for PWA video; 100ms or Twilio are drop-in alternatives. Native SDKs arrive with Expo.
4. **Chat:** Socket.io with the Redis adapter, per ADR-03 in `ArchitectureBlueprint.md`. The gating rule remains open (see below).
5. **Media storage:** S3-compatible bucket (AWS S3 or Cloudflare R2), private by default, short-lived signed URLs.
6. **Messaging:** Web Push with VAPID for the PWA; FCM/APNs arrive with Expo. MSG91 (or equivalent) for SMS; SES/Postmark for email.
7. **Pricing — confirmed for launch:** all product features are free during the launch trial. Plans, prices, durations and entitlements remain database configuration and are resolved through one `EntitlementService`, so a feature can be made paid later by changing configuration and enabling the payment flag, not by rewriting feature code. INR price points are still required before billing is switched on.
8. **Caste/sub-caste seed list — confirmed:** the client will provide the list later; it is seeded into the database through a versioned seed file/API. The taxonomy, stable codes and admin management are built now, not the final list.
9. **Moderation staffing:** auto-moderation plus a human queue; the SLA assumes at least one reviewer per shift. Exact staffing and hours remain open.
10. **Public marketing site:** the same `UserWeb` build serves the marketing pages and the member PWA. Route-level code splitting keeps the marketing payload light.
11. **Expo timing — confirmed:** the Expo app starts only after the entire PWA (Phases 1–3) is complete and passes its exit criteria; no native work is in the launch roadmap.

---

## Problem Statement

Marriage-minded people from the Dhobi/Rajaka community, and the parents and relatives who often manage profiles on their behalf, currently depend on general-purpose matrimony platforms or informal community networks. General platforms do not model the community's sub-castes, gotra, horoscope and family expectations well; informal networks lack verification, privacy controls and safe communication. Existing users also face fake profiles, harassment, unclear pricing and no reliable way to prove identity before sharing personal contact details.

The current codebase only solves a thin slice of this: account registration, a five-step profile form, and a basic admin approve/reject screen. It does not capture the depth of information families need to make a decision, does not verify identity or photos, does not support discovery, matching, interests or chat, and has no installable, mobile-grade experience.

## Solution

Build a mobile-first, community-specific matrimony product delivered as an installable PWA, backed by the existing NestJS API and admin panel.

1. **A member PWA** (React + Vite + Tailwind, in `UserWeb`) for onboarding, profile creation, photo and ID verification, discovery, search, interests, shortlisting, chat, horoscope and membership. It is responsive, installable, works offline for drafts, and can send web push to installed devices.
2. **A NestJS API** that owns identity, profiles, verification, matching, engagement, messaging, payments, notifications and all business rules.
3. **An admin panel** for reviewing submissions, verifying identities and photos, moderating content, supporting members and operating the marketplace.
4. **A shared `packages/core` layer** containing the API client, schemas, types, formatters, validators and domain rules, so the later Expo app reuses the product logic unchanged.

The product is free to join and browse. Verified profiles are the default: no profile becomes visible to other members until the member passes OTP, completes the mandatory profile, passes government ID and photo verification, and is approved by an admin. Members can express interest and shortlist for free; Prime unlocks contact details and chat. The experience is available in English, Hindi and Gujarati, and privacy controls let members decide who sees their photos, contact details and activity.

---

## User Stories

> Membership-gated stories describe the target paid state. During the launch trial every feature is free; see "Billing and entitlements" in Implementation Decisions.

### Language, account and onboarding

1. As a first-time visitor, I want to choose English, Hindi or Gujarati on the very first screen, so that I can use the app in the language I understand.
2. As a returning member, I want my language choice remembered, so that I do not have to select it again.
3. As a member, I want to change my language later in Settings without losing data, so that my preference can evolve.
4. As a visitor, I want a clear landing screen explaining the community focus and trust promise, so that I can decide to register.
5. As a visitor, I want to see that profiles are verified and privacy is protected, so that I feel safe registering.
6. As a visitor, I want to select who the profile is for (myself, son, daughter, brother, sister, friend, relative), so that the profile reflects the right perspective.
7. As a parent, I want to create and manage a profile on behalf of my child, so that I can help without pretending to be them.
8. As a visitor, I want to register with my name, email, password and mobile number, so that I can create an account.
9. As a visitor, I want clear password rules and a show/hide toggle, so that I can create a secure password without errors.
10. As a visitor, I want to receive an OTP on my mobile, so that I can prove I own the number.
11. As a visitor, I want to resend the OTP after a cooldown, so that I can recover from a delayed SMS.
12. As a visitor, I want a limited number of OTP attempts and resends, so that my account is protected from abuse.
13. As a visitor, I want an email OTP fallback, so that I can still verify if SMS fails.
14. As a visitor, I want to accept the Terms and Privacy Policy and give explicit consent for ID processing, so that I understand what I am agreeing to.
15. As a member, I want to log in with email and password, so that I can return to my account.
16. As a member, I want to reset my password securely, so that I can recover access.
17. As a member, I want my session refreshed automatically, so that I am not logged out mid-task.
18. As a member, I want to log out of all devices, so that I can secure my account.
19. As a member, I want to resume an incomplete profile exactly where I left off, so that I do not lose progress.
20. As a member, I want each section saved automatically, so that I never lose what I typed.
21. As a member, I want to see a profile completion percentage, so that I know what is left.
22. As a member, I want to jump back to a completed section, so that I can correct a mistake.
23. As a member, I want to edit my profile after approval, so that it stays current.
24. As a member, I want to be told which fields can only be changed once, so that I do not make an irreversible mistake.
25. As a member, I want to delete my account and data, so that I can exercise my privacy rights.
26. As a member, I want to export my data, so that I can see what the platform holds about me.

### PWA experience

27. As a mobile visitor, I want the app to work well on a small screen and slow connection, so that I can use it on any phone.
28. As a returning visitor, I want to install the app to my home screen, so that it opens like a native app.
29. As a member, I want an offline-safe draft of the section I am editing, so that a network drop does not lose my work.
30. As a member, I want a clear update prompt when a new version is available, so that I am not stuck on stale code.
31. As an installed member, I want web push for interests, messages and approvals, so that I can respond quickly.
32. As a member, I want to share my biodata using the device share sheet, so that I can send it to family.
33. As a low-bandwidth member, I want images and pages to load progressively, so that I do not burn data.
34. As a member, I want the app to work on Android, iOS and desktop browsers, so that I can use the device I have.

### Profile creation

35. As a member, I want to enter my gender, date of birth, height, weight and body type, so that matches can assess basic compatibility.
36. As a member, I want my age calculated automatically and blocked below the legal minimum, so that the platform stays compliant.
37. As a member, I want to set my marital status, so that I am matched appropriately.
38. As a member, I want to set my physical status, so that the right matches can find me.
39. As a member, I want to record my mother tongue and the languages I speak, so that language compatibility is visible.
40. As a member, I want to record my religion, community, sub-caste and gotra, so that community matches are accurate.
41. As a member, I want to say I am open to any sub-caste, so that I am not filtered out unnecessarily.
42. As a member, I want to record my dosh and manglik status, so that horoscope-conscious families can assess compatibility.
43. As a member, I want to record my country, state and city, so that location-based matching works.
44. As a member, I want to record my citizenship and resident status, so that NRI and visa-related expectations are clear.
45. As a member, I want to record whether I am interested in settling abroad, so that I attract like-minded matches.
46. As a member, I want to add my highest degree, specialisation, institute and year, so that my education is credible.
47. As a member, I want to add post-graduation, under-graduation and school details, so that my full academic history is available.
48. As a member, I want to add my employment type, occupation, employer and income range, so that career compatibility is clear.
49. As a member, I want to write about my education and career in my own words, so that I can add context.
50. As a member, I want to describe my family type, values and status, so that families can assess background.
51. As a member, I want to add my parents' occupations and living status, so that my family situation is clear.
52. As a member, I want to add sibling counts and optional sibling details, so that my family is fully represented.
53. As a member, I want to say whether I live with my parents and where my family is based, so that expectations are set.
54. As a member, I want to record my diet, smoking, drinking and pet preferences, so that lifestyle compatibility is visible.
55. As a member, I want to record assets such as house and car ownership, so that I can present my situation.
56. As a member, I want to add hobbies, interests, music, books, sports, cuisine and movies, so that shared interests can be discovered.
57. As a member, I want to write an "About me" section, so that I can express my personality.
58. As a member, I want to answer five profile prompts, so that my profile feels human and engaging.
59. As a member, I want to choose five interests, so that matches can see what we share.
60. As a member, I want to add alternate email, alternate mobile, WhatsApp and landline details, so that matches can reach me after I allow it.
61. As a member, I want my contact details hidden by default, so that I control my privacy.
62. As a member, I want to choose who can see each contact field, so that I can share selectively.
63. As a member, I want to add my birth date, time and place, so that my horoscope can be generated.
64. As a member, I want my rashi, nakshatra and manglik status shown, so that horoscope matching is transparent.
65. As a member, I want to upload my janampatri, so that families can review the full chart.
66. As a member, I want to set partner preferences for age, height, marital status, language, location, religion, community, education, career and lifestyle, so that I see relevant matches.
67. As a member, I want to mark preferences as dealbreakers or nice-to-haves, so that the matching engine respects my priorities.
68. As a member, I want to see how many of my preferences a profile matches, so that I can compare candidates.
69. As a member, I want to upload a clear profile photo, so that my profile is credible.
70. As a member, I want to upload a gallery of photos, so that matches can see more of me.
71. As a member, I want to reorder photos and choose the primary one, so that my best photo leads.
72. As a member, I want to know if a photo is under validation, approved or rejected, so that I can fix problems.
73. As a member, I want to choose who can see my photos, so that I control exposure.

### Verification and approval

74. As a member, I want to upload one accepted government ID (Aadhaar, PAN, driving licence, ration card or voter ID), so that I can prove my identity.
75. As a member, I want to take a live selfie, so that the system can confirm I am the person on the ID.
76. As a member, I want to capture my ID with my phone camera or upload a file, so that I can complete verification on any device.
77. As a member, I want the system to read my name and date of birth from my ID, so that I do not have to type them again.
78. As a member, I want to be told clearly if my ID is unreadable, expired or the wrong type, so that I can retry correctly.
79. As a member, I want to retry verification after a failure, so that a bad photo does not block me permanently.
80. As a member, I want repeated failures escalated to manual review rather than an automatic rejection, so that I get a fair outcome.
81. As a member, I want to see that my ID number is masked, so that my document data is protected.
82. As a member, I want to submit my profile when all mandatory sections are complete, so that it can be reviewed.
83. As a member, I want a clear confirmation that my profile is under review within 24–48 hours, so that I know what happens next.
84. As a member, I want push, SMS and email notification of the decision, so that I do not have to keep checking.
85. As a member, I want to see the exact reason when changes are requested or my profile is rejected, so that I can fix it.
86. As a member, I want to resubmit after corrections without re-entering everything, so that recovery is quick.
87. As a member, I want verification badges on my profile once approved, so that others trust me.
88. As a member, I want to be blocked from entering the main app until approval, so that unverified profiles cannot browse.
89. As an admin, I want a queue of pending profiles ordered oldest first, so that the 48-hour promise is met.
90. As an admin, I want a side-by-side view of the ID and profile photo, so that I can compare them quickly.
91. As an admin, I want to see the member's photo, ID proof, name/DOB and (when available) OCR/face-match scores and the age-check result, so that I can make an informed decision.
92. As an admin, I want to approve a profile with one action, so that good profiles go live quickly.
93. As an admin, I want to reject a profile with a reason, so that the member understands and can appeal.
94. As an admin, I want to request specific changes, so that minor issues do not force a full rejection.
95. As an admin, I want an SLA timer on every pending profile, so that overdue reviews are visible.
96. As an admin, I want to override a one-time-edit field when there is a genuine mistake, so that members are not stuck.
97. As an admin, I want every ID view and decision logged, so that access is accountable.

### Discovery and search

98. As a member, I want a daily set of curated recommendations, so that I do not have to search from scratch.
99. As a member, I want to see reverse matches — people whose preferences match me — so that I know who is likely to respond.
100. As a member, I want to see new members who match my preferences, so that I can act early.
101. As a member, I want to see who is online now, so that I can start a conversation when it is timely.
102. As a member, I want to search by age, height, marital status, religion, community, language, location, education, profession, income, diet and manglik status, so that I can narrow results.
103. As a member, I want to search by profile ID, so that I can find a specific person.
104. As a member, I want to save a search, so that I can repeat it later.
105. As a member, I want to sort results by relevance, newest, last active or compatibility, so that I can browse the way I prefer.
106. As a member, I want to open a full profile with photos, personal, professional, family, lifestyle, horoscope and preferences, so that I can evaluate a match.
107. As a member, I want to see why a profile is recommended, so that the match is explainable.
108. As a member, I want to see verification badges, so that I can prioritise trustworthy profiles.
109. As a member, I want contact details masked until I am entitled to see them, so that privacy is preserved.
110. As a member, I want to see who viewed my profile, so that I can gauge interest.
111. As a member, I want to control whether my last-seen and online status are visible, so that I control my activity privacy.
112. As a member, I want to hide my profile temporarily, so that I can take a break.
113. As a member, I want to block a member, so that they cannot see or contact me.
114. As a member, I want to report a profile, so that harmful behaviour is reviewed.
115. As a member, I want to see interests we share, so that I have a conversation starter.
116. As a member, I want to see horoscope compatibility, so that I can consider it before expressing interest.
117. As a member, I want to filter by manglik status and horoscope availability, so that I only see relevant profiles.
118. As a member, I want a clear empty state with suggestions when a search returns nothing, so that I can adjust.
119. As a member, I want to understand how profile completeness affects my visibility, so that I am motivated to complete it.

### Engagement

120. As a member, I want to express interest with one tap, so that I can act quickly.
121. As a Prime member, I want to attach a personalised note to an interest, so that I stand out.
122. As a member, I want to accept or decline an interest, so that I control who can contact me.
123. As a member, I want separate received and sent interest lists, so that I can track both directions.
124. As a member, I want to filter interests by status, so that I can focus on pending ones.
125. As a member, I want to shortlist a profile, so that I can return to it.
126. As a member, I want multiple named shortlists, so that I can organise candidates.
127. As a member, I want to add one profile to several shortlists, so that I do not duplicate work.
128. As a member, I want to remove a profile from a shortlist, so that my lists stay accurate.
129. As a member, I want to ignore a profile permanently, so that it stops appearing.
130. As a member, I want a short undo window for ignore, so that an accidental tap is recoverable.
131. As a member, I want notifications for new matches, interests, messages and profile views, so that I stay informed.
132. As a member, I want to control which notifications I receive and on which channel, so that I am not overwhelmed.
133. As a member, I want to see the status of every interest I sent, so that I know where I stand.
134. As a member, I want a mutual-match indicator, so that I know when to start a conversation.
135. As a member, I want contact details revealed after acceptance or upgrade, so that I can connect.
136. As a Prime member, I want to chat inside the app after mutual interest, so that I do not share my number too early.
137. As a member, I want real-time message delivery, so that conversations feel natural.
138. As a member, I want read receipts and typing indicators, so that I know the other person is engaged.
139. As a member, I want to mute a conversation, so that it stops interrupting me.
140. As a member, I want to delete a conversation, so that I control my inbox.
141. As a member, I want to report or block from inside a chat, so that I can act immediately on harassment.
142. As a member, I want abusive messages filtered and rate-limited, so that the platform stays safe.
143. As a member, I want to know the outcome of my report, so that I trust the process.
144. As a member, I want to keep my phone number private while chatting, so that I control when to share it.
145. As a Prime member, I want in-app video calling, so that I can meet without sharing personal numbers.
146. As a member, I want to join a live event and meet several matches in an hour, so that I can broaden my search.

### Horoscope and biodata

147. As a member, I want a biodata PDF generated from my profile, so that I can share it with family.
148. As a member, I want to preview the biodata before downloading, so that I know what will be shared.
149. As a member, I want to choose between biodata templates, so that it matches my preference.
150. As a member, I want the biodata in my chosen language, with correct Devanagari and Gujarati fonts, so that nothing breaks.
151. As a member, I want my horoscope chart included, so that families have the full picture.
152. As a member, I want my contact details hidden in the biodata by default, so that my privacy is protected.
153. As a member, I want the biodata to update when I edit my profile, so that it never goes stale.
154. As a member, I want a 36-point Guna Milan score with a clear explanation, so that I can assess horoscope compatibility.
155. As a member, I want doshas such as Manglik and Nadi dosh explained, so that I can make an informed decision.
156. As a member, I want a horoscope badge on profiles that have one, so that I can filter quickly.

### Membership and payments

157. As a member, I want to compare Free, Prime and Elite plans, so that I can choose what fits.
158. As a member, I want a clear list of what each plan unlocks, so that I am not surprised after paying.
159. As a member, I want to pay with Razorpay using UPI, cards, netbanking or wallets, so that I can pay the way I prefer.
160. As a member, I want to see my active plan and expiry date, so that I know what I have.
161. As a member, I want to cancel auto-renewal easily, so that I stay in control.
162. As a member, I want an invoice for my payment, so that I can claim it.
163. As a member, I want a refund within the stated guarantee window, so that I can buy with confidence.
164. As a free member, I want to see which features are locked and why, so that I can decide to upgrade.
165. As a member, I want prices in INR with taxes shown, so that there are no surprises.
166. As a member, I want a renewal reminder before I am charged, so that I am not caught off guard.
167. As an admin, I want to configure plans, prices and entitlements without a release, so that commercial changes are fast.
168. As an admin, I want to see revenue, conversion and churn, so that I can run the business.
169. As an admin, I want to grant or revoke a plan for support reasons, so that I can resolve complaints.
170. As an admin, I want to issue a refund, so that I can honour the guarantee.
171. As the system, I want to validate payment webhooks idempotently, so that entitlements are accurate.
172. As a member, I want my purchase restored when I sign in on another device, so that I do not pay twice.

### Admin, operations and support

173. As an admin, I want to log in with MFA, so that the back office is protected.
174. As an admin, I want a dashboard of pending reviews, reports, signups, revenue and SLA breaches, so that I know what needs attention.
175. As an admin, I want to search members by profile ID, email or mobile, so that I can help them.
176. As an admin, I want to view any profile and its verification history, so that I can investigate.
177. As an admin, I want to suspend, ban or restore an account with a reason, so that enforcement is consistent.
178. As an admin, I want to reset verification or resend an OTP, so that I can unblock a genuine member.
179. As an admin, I want a photo moderation queue, so that unsafe images never go live.
180. As an admin, I want a report queue with evidence, so that I can act on abuse.
181. As an admin, I want an immutable audit log of every sensitive action, so that the platform is accountable.
182. As an admin, I want to export audit data, so that I can support legal requests.
183. As a support agent, I want a ticket queue with canned responses, so that I can resolve issues quickly.
184. As an admin, I want feature flags and maintenance mode, so that I can ship safely.
185. As an admin, I want to manage app versions and force-update rules, so that stale clients are retired.
186. As an admin, I want to edit reference data such as religions, castes, education and occupations, so that the taxonomy stays accurate.
187. As an admin, I want to send a targeted broadcast, so that I can announce important changes.
188. As an admin, I want to process data-deletion and data-export requests, so that DPDP obligations are met.

### Non-functional and platform

189. As a member, I want my draft to survive a network drop, so that I do not lose work.
190. As a member with a screen reader, I want labelled controls and logical reading order, so that I can use the app independently.
191. As a member, I want text to scale without breaking layout, so that I can read comfortably.
192. As a member, I want search results quickly even on a slow connection, so that the app feels responsive.
193. As a member, I want notifications that open the right screen, so that I can act in one tap.
194. As a member, I want biometric or device unlock on supported devices, so that my private profile is protected.
195. As a member, I want deep links to profiles and interests, so that shared links work.
196. As a member, I want my session to expire safely, so that a lost phone does not expose my account.
197. As a member, I want to be told if my data is breached, so that I can protect myself.
198. As a member, I want to read the privacy policy and contact a grievance officer, so that I can exercise my rights.
199. As a member, I want a clear update prompt, so that I am never stuck on an unsupported version.
200. As a member, I want dates, currency and numbers formatted for my language, so that the app feels local.
201. As a Hindi or Gujarati speaker, I want the entire app, notifications and emails in my language, so that I never have to fall back to English.
202. As the platform, I want end-to-end tracing and alerting, so that incidents are detected and fixed quickly.
203. As the platform, I want automated backups and a tested restore, so that data loss is bounded.
204. As the platform, I want authorization tests for every role, so that IDOR and privilege escalation are caught before release.
205. As the platform, I want abuse and rate-limit controls on OTP, search, interests and messages, so that the service stays available.
206. As the platform, I want a documented OpenAPI contract, so that PWA, web and admin clients stay in sync.
207. As the platform, I want a single automated release pipeline, so that every change is built, tested and deployable.
208. As the product team, I want the domain and API layer isolated from the web UI, so that the later Expo app can reuse it without a rewrite.

---

## Implementation Decisions

### Platform and codebase

- The member product is a **mobile-first PWA** built inside the existing `UserWeb` React + Vite + Tailwind codebase. It becomes an installable app with a web app manifest, service worker, offline shell and push notifications.
- The PWA is responsive from 320 px to desktop. The primary design target is a 360–430 px phone viewport; desktop gets a centred, constrained layout rather than a separate product.
- **Shared core:** framework-agnostic code moves to `packages/core` — API client, Zod schemas, TypeScript types, formatters, validators, domain rules, i18n resources and platform adapter interfaces. `UserWeb` consumes it now; the Expo app will consume the same package later.
- **Platform adapters** isolate capabilities that differ between web and native: secure storage, camera capture, push notifications, share sheet, deep links, biometrics, network status and app-update checks. The PWA provides web implementations; Expo will provide native implementations behind the same interfaces.
- The NestJS API remains the single source of business truth. It is extended module by module: `auth`, `profiles`, `media`, `verification`, `discovery`, `engagement`, `messaging`, `notifications`, `horoscope`, `billing`, `admin`, `taxonomy`, `audit`.
- The AdminPanel remains a React + Vite SPA, extended with review, moderation, support, taxonomy and analytics screens.
- A shared API contract package is generated from the backend OpenAPI document and consumed by the PWA and admin. Breaking changes require a version bump and a deprecation window.
- The backend stays a modular monolith. Modules communicate through explicit service interfaces, not cross-module database access, so a future extraction to services is possible without rewriting domain logic.
- No PWA-only assumption is allowed to leak into `packages/core`. Browser APIs are referenced only inside the web adapter implementations.

### PWA behaviour

- **Installability:** valid manifest, 192/512 icons, maskable icon, theme colour, `display: standalone`, start URL, screenshots and short description. A contextual install prompt appears after a member completes onboarding, not on first load.
- **Offline:** an app-shell service worker caches the shell, fonts and static assets. Profile drafts are persisted to IndexedDB on change and restored on reload. The app shows an explicit offline banner and queues idempotent saves for retry.
- **Updates:** the service worker is versioned; a new build triggers an in-app "Update available" prompt with a controlled reload (skip-waiting). No silent reload while a form is dirty.
- **Push:** Web Push with VAPID keys; subscriptions stored per device. Critical events (approval, rejection, interest, message) also go by SMS/email so iOS members without an installed PWA are not missed.
- **Camera:** `getUserMedia` for selfie capture and `capture="environment"` file input for documents, with a file-upload fallback and clear framing guidance. A hosted KYC web flow is used where stronger liveness is required.
- **Share:** Web Share API for biodata PDFs and profile links, with download/copy-link fallbacks.
- **Performance:** route-level code splitting, image CDN with responsive variants, virtualised lists, skeleton states and a performance budget enforced in CI.
- **Accessibility:** WCAG 2.1 AA, keyboard navigable, visible focus, semantic landmarks and screen-reader labels.

### Data and schema

- PostgreSQL remains the system of record. Migrations are raw SQL via `node-pg-migrate`; complex reads stay in stored functions where they already exist.
- New tables are additive. Existing tables are extended, not replaced. Every new table has `id`, `createdAt` and `updatedAt`; soft delete is used where recovery matters (`deletedAt`).
- Profile data is split by section, mirroring the existing step tables: personal, religious, location, education, professional, family, lifestyle, assets, contact, horoscope, prompts, interests, partner preferences, privacy settings.
- Reference data (religions, communities, sub-castes, gotras, education levels, occupations, income ranges, languages, interests, prompts, photo/ID rejection reasons) lives in taxonomy tables with an admin UI and a stable code, not in hardcoded client lists.
- Multi-valued fields use join tables (or text arrays where the existing schema already does so) with indexes appropriate to search.
- All PII and document data is classified. ID numbers, contact details and ID image URLs are encrypted at rest; ID numbers are masked in every read model.
- A profile submission/review model records the submitted snapshot, reviewer, decision, reason and timestamps, so the review history is auditable even after the member edits.
- A status state machine is the only way account/profile status changes. Direct status writes are prohibited outside the domain service.
- Consent is a first-class, versioned record: consent code, document version and hash, the exact text shown, user name, IP, user agent, granted/expiry/revoked timestamps and source. The current consent documents are seeded; the API serves them and records acceptance. The default validity is 24 months, after which the member must re-consent.

### Profile and completion

- The onboarding wizard is section-based and resumable. Mandatory sections must be complete before submission; optional sections are clearly labelled and can be completed later from Edit Profile.
- Completion percentage is computed from weighted required fields, not from a count of sections. The exact weights live in the field dictionary and are server-computed so all clients agree.
- One-time-edit fields are gender, date of birth, religion, community, sub-caste, height, marital status and mother tongue. They may be changed once by the member; further changes require an admin override with a reason.
- Age is derived from date of birth, never stored as a mutable number. The age gate is enforced on the server and re-checked during ID verification: men must be at least 21, women at least 18.
- Contact details are private by default and have per-field visibility: only me, accepted matches, Prime members, everyone. Revealing contact details is also gated by entitlement.
- Photos and ID documents are never served from public URLs. The API issues short-lived signed URLs after an authorization check.
- Profile visibility respects block, hide, photo-visibility and privacy settings at the query layer, not only in the client.

### Verification and approval

- The verification pipeline is a sequence of explicit states. At launch: not started → consent given → member photo and ID proof uploaded → manual admin review → approved / rejected / changes requested. When a managed provider is enabled, the same pipeline adds OCR, face match, liveness and age-check steps before `passed` / `needs review` / `failed`.
- Launch verification is manual: the member selects/uploads a photo and government ID proof, and an admin compares the name, DOB, photo and document validity. The `KycProvider` interface abstracts document OCR, face match and liveness so a managed provider can be added later without changing the domain workflow; `ManualKycProvider` is the launch implementation and routes every case to `needsReview`.
- Auto-approval is disabled at launch. When a managed provider is enabled, auto-approval is allowed only when OCR confidence, name similarity, face-match score and age check all exceed configured thresholds. Everything else goes to manual review.
- A member cannot submit without a passing verification and at least one approved primary photo.
- Admin decisions are approve, reject and request changes. Every decision requires a reason from a controlled vocabulary plus optional free text.
- The review queue is oldest-first with an SLA clock. Breaching 48 hours raises an alert; it does not auto-approve.
- Verification documents are retained only as long as the retention policy allows. After the retention window, raw images are deleted and only the derived result, hash and audit record remain.
- Every admin view of a document is logged with admin ID, profile ID, timestamp, IP and user agent.

### Discovery, matching and ranking

- Hard filters (blocked, hidden, same user, under-age, non-approved) are applied first and are never overridden by ranking.
- Compatibility is a two-sided score: the viewer's preferences against the candidate, and the candidate's preferences against the viewer. The lower of the two sides is weighted more heavily than the average.
- The score is explainable: the API returns the reasons a profile matched and the preferences that did not.
- Daily recommendations are capped (nine per day by default), deduplicated, and exclude profiles already actioned, hidden, blocked or recently shown.
- Ranking combines compatibility, profile completeness, recent activity, verification status, membership boost and recency. Weights are configuration, not code.
- Search starts with indexed SQL filters and cursor pagination. Expensive ranking is computed after the candidate set is bounded. A materialised recommendation table supports the daily feed.
- Horoscope matching (Guna Milan) is a separate Phase 3 engine and never blocks basic discovery.

### Engagement, chat and safety

- Interests are one-directional records with pending, accepted and declined states. A mutual interest creates a match/conversation eligibility.
- Shortlists support multiple named collections and many-to-many membership.
- Ignore/hide is permanent from the member's perspective, with a short undo window. It is enforced in every discovery query.
- Chat is available only after a mutual match and a Prime entitlement on at least one side; the other side may reply without Prime. The server enforces eligibility; the client only hides UI.
- Messaging uses Socket.io with the Redis adapter. Messages are persisted before acknowledgement. Read receipts and typing are ephemeral events.
- Message content is scanned for abuse and rate-limited per sender and conversation. Media messages are Phase 2 and go through the same media pipeline.
- Reports and blocks are first-class records. Repeated reports can auto-hide a profile pending review. Every enforcement action is audited.
- Contact reveal is an entitlement-gated action and is audited. Masked values are computed server-side; the client never receives the full value before entitlement.

### Notifications

- A single notification service fans out to in-app, web push, SMS and email according to member preferences and event type.
- Events have stable codes and localized templates in all three languages. User-generated content is never translated.
- Delivery is asynchronous through BullMQ with retries, dead-letter handling and idempotency keys.
- Push subscriptions are stored per device, refreshed on permission grant and removed on logout or `pushsubscriptionchange`. Expired subscriptions are pruned automatically.
- Because iOS push requires an installed PWA, critical events always have an SMS or email fallback.

### Billing and entitlements

- **Launch mode:** every feature is free during the launch trial. There is no paywall, no Razorpay checkout and no plan-selection screen in the member journey yet. The entitlement service, plan configuration and provider adapter are still built and tested, so switching a feature to paid later is a configuration and flag change, not a rewrite.
- A single server-side `EntitlementService` answers `can(member, key)` for every gated capability. Feature code calls that service, never a plan name or a hardcoded boolean. A `billingEnabled` flag and per-entitlement `freeInLaunchMode` configuration control the launch state.
- Plans, prices, durations and entitlements are database configuration, not code. A plan change does not require a release.
- Razorpay handles payments at launch via web checkout: order creation → checkout → signature verification → webhook reconciliation → entitlement grant.
- The backend validates every webhook server-side, stores the raw payload, and is idempotent on provider event ID.
- Entitlements are resolved server-side per request; the client may cache them but never decides access.
- Auto-renewal, cancellation, grace period, refunds, invoices and GST details follow provider capabilities and local law. Razorpay subscriptions or a scheduled renewal job handle recurring payments.
- Free members can browse, search, express interest and shortlist. Prime unlocks contact details, chat, personalised interest notes, who-viewed-me and advanced discovery. Elite adds assisted matchmaking in Phase 3.
- Store billing (Apple/Google) and RevenueCat are deliberately deferred to the Expo migration; the entitlement service is provider-agnostic so adding them does not change product logic.

### Horoscope and biodata

- Horoscope capture stores birth date, time and place plus optional chart upload. Rashi, nakshatra and manglik can be computed or entered, with the source recorded.
- Chart rendering and Guna Milan run server-side so every device and the PDF agree. The astrology calculation is isolated behind an engine interface and validated against known reference charts.
- Biodata is generated server-side from an HTML template rendered to PDF. It uses Noto Sans Devanagari and Noto Sans Gujarati, A4 layout, and the member's chosen language and template.
- The biodata is available to the owner only after admin approval; contact details are hidden by default. It regenerates from current data on every request or cache invalidation.
- PDFs are watermarked with the profile ID, access-controlled, and never indexed or public. The PWA downloads or shares them through the platform adapter.

### Admin and operations

- Admin roles are super admin, reviewer, moderator, support and analyst, with least-privilege permissions and MFA for every admin.
- The review screen is a single high-density workspace: profile summary, section tabs, ID/photo comparison, scores, notes and decision controls.
- Moderation, reports, support tickets and refunds are separate queues with filters and SLA views.
- Reference data is editable in the admin panel with validation and audit. Changes invalidate relevant caches.
- Feature flags gate risky features (chat, video, payments, horoscope matching) by environment, platform and percentage rollout.
- A maintenance mode and minimum-supported-version gate protect the service during incidents. For the PWA, the version gate forces a service-worker refresh.

### API and integration conventions

- REST over HTTPS under `/api/v1`, JSON, camelCase, ISO-8601 timestamps, UUID identifiers, cursor pagination for feeds and offset pagination only for admin tables.
- Errors use one envelope: `code`, `message`, `details`, `requestId`. Validation errors list field-level issues.
- Writes that can be retried (payments, submissions, uploads) accept an idempotency key.
- Authentication is a short-lived access JWT in memory plus a rotating refresh token in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie for the PWA. Admin authentication is separate and MFA-protected. The Expo app will use platform secure storage with the same token model.
- All mutations are authorised by role and ownership checks. The API never trusts a client-supplied user ID.
- The OpenAPI document is generated from the backend and published as the contract for PWA and admin clients.
- Third-party integrations sit behind adapters: KYC, payments, SMS, email, push, object storage, video. Each adapter has a fake implementation for tests.

### Non-functional baseline

- Security, privacy, i18n, accessibility, performance, observability and retention requirements are mandatory acceptance criteria, not polish. See `spec/10-non-functional.md`.
- The default PII retention and consent validity window is 24 months. At expiry the member is prompted to re-consent through the API; refusal triggers the documented consequence. Statutory financial and audit retention overrides the default where required.
- The API is stateless and horizontally scalable; Redis and BullMQ carry shared state and background work.
- Media is served through a CDN with signed URLs. Images are re-encoded, stripped of EXIF and resized into responsive variants.
- Every release passes lint, type-check, unit, API contract, PWA smoke and admin smoke tests in CI.

---

## Testing Decisions

### What makes a good test

- Tests assert **external behaviour**: HTTP status and body, persisted state visible through the API, UI text the member sees, and side effects such as a notification or audit record. Tests do not assert private methods, internal call order or database implementation details.
- A test must fail for a real product regression and pass for any valid implementation of the same contract.
- Tests use deterministic clocks, fixed UUIDs where identity matters, and fake external providers. No test depends on the live internet, a real SMS or a real payment.
- Every acceptance criterion in this spec maps to at least one test at the appropriate seam.
- Security tests are written as authorization matrices, not one-off checks: for each endpoint, each role and each ownership case.

### Seams

Five seams, highest possible, with the fewest new ones:

1. **Primary seam — HTTP API contract tests (NestJS + supertest + real PostgreSQL).** This covers the majority of behaviour: auth, onboarding, submission, admin review, discovery, interests, chat REST, payments, biodata and privacy rules. Prior art: `Backend/test/app.e2e-spec.ts`; reuse the existing Jest + supertest setup and the `docker-compose` Postgres.
2. **PWA UI seam — Playwright end-to-end flows** against a seeded backend, using mobile device emulation (Pixel 7 and iPhone 14) plus one desktop viewport. Covers OTP entry, section navigation, photo capture fallback, pending state, approved home, interest, chat and install/offline behaviour.
3. **Admin UI seam — Playwright** against the AdminPanel with a seeded database. Covers the review workspace, moderation queue, reason capture and audit visibility.
4. **Contract seam — OpenAPI schema validation.** The generated document is validated in CI, and PWA/admin clients are type-checked against it. This catches drift without duplicating endpoint tests.
5. **Unit seam — pure domain logic only.** Age gate, completion computation, compatibility scoring, reciprocal matching, Guna Milan, entitlement resolution, contact masking, plan proration and i18n interpolation. Table-driven tests, no mocks of the database.

### Modules and coverage expectations

- **Backend:** all public endpoints have at least one happy path and the critical negative/authorization paths. Domain services have unit tests for the scoring and state-machine rules. Stored functions are covered through the API seam rather than tested directly.
- **PWA:** every critical journey has a Playwright flow; pure helpers (formatters, validators) have unit tests. Service-worker, offline-draft, install-manifest and push-subscription behaviour have dedicated checks. Snapshot tests are not used as a substitute for behaviour tests.
- **Admin:** every destructive or decision action has a Playwright test that asserts the resulting state and audit entry.
- **Consent and manual KYC:** tests cover versioned consent capture (exact text, IP, user name, timestamp, expiry), re-consent at 24 months, and the admin manual verification path including approve, reject and request-changes.
- **Targets:** domain logic ≥ 90% line coverage; backend API ≥ 80%; PWA critical-path flows 100% passing; Lighthouse PWA installability and performance budgets met; no merge with a failing contract or smoke test.

### Prior art and conventions

- Existing API tests use Jest + supertest with the Nest testing module. New tests follow the same structure and add factories/seed helpers.
- The repository currently has no frontend tests. Playwright is introduced with the first critical flows, not retrofitted later.
- Test data is created through factories or seed scripts, not raw inserts scattered across tests. Each suite resets to a known state.
- External providers use deterministic fakes: `FakeKycProvider`, `FakePaymentProvider`, `FakeSmsProvider`, `FakePushProvider`, `FakeStorageProvider`.
- CI runs against ephemeral Postgres and Redis services; PWA smoke runs in Chromium with a mobile viewport and an API container.

### Release gates

- A release is blocked by: failing unit, API, contract or smoke tests; a failing accessibility check on changed screens; a failing Lighthouse PWA/performance budget; a high-severity dependency or container vulnerability; or an authorization matrix gap.
- Payment, verification and privacy changes additionally require a manual review sign-off recorded in the release notes.

---

## Out of Scope

- Copying Shaadi.com's name, logo, visual design, copy or branding. Only functional inspiration is used.
- A native mobile app at launch. Expo/React Native is a planned post-PWA migration, specified in `spec/14-expo-migration.md`, not part of the launch scope.
- App Store / Play Store distribution and in-app purchase billing at launch. These arrive with the Expo migration; launch payments are Razorpay only.
- A separate desktop product. The PWA adapts to desktop, but the primary experience is mobile.
- Communities and religions beyond the Dhobi/Rajaka, Hindu-focused launch scope. The taxonomy is extensible, but launch content is scoped.
- Weddings, venue booking, gift registry or e-commerce. Promotional cards may link out, but no commerce is built.
- Astrology consultation marketplace, puja services or paid religious services.
- Background verification beyond government ID, face match and admin review. Employment or criminal background checks are Phase 3 commercial add-ons only.
- AI matchmaking, chatbots or automated conversation assistants. Recommendations are rule/score based.
- Offline messaging, end-to-end encrypted chat, or self-destructing messages.
- Multi-tenant white-labelling for other communities or matchmakers.
- Regional languages beyond English, Hindi and Gujarati at launch.
- International payment methods beyond Razorpay-supported instruments at launch.
- Native desktop admin apps, public APIs for third-party developers, or a partner portal.
- Data residency beyond the chosen cloud region; legal review of cross-border transfer is a separate workstream.

---

## Further Notes

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fake profiles and stolen photos | ID + live selfie + face match + perceptual-hash duplicate detection + photo moderation |
| Harassment and stalking | Contact hidden by default, block/report, rate limits, message scanning, admin enforcement, audit |
| KYC false negatives block genuine members | Retry path, manual review escalation, support override, clear reasons |
| Browser liveness is weaker than native | Hosted KYC flow, challenge-response selfie, manual review, native liveness after Expo migration |
| iOS push is limited for non-installed PWAs | Install prompt, in-app notification centre, SMS/email fallback for critical events |
| Service-worker staleness | Versioned cache, update prompt, skip-waiting flow, minimum-version gate |
| Payment chargebacks | Server-side signature and webhook validation, idempotency, refund policy, audit |
| Horoscope calculation disputes | Isolated engine, reference-chart test suite, source labels, manual override |
| PII breach | Encryption at rest, field-level encryption, least-privilege access, audit, retention, breach playbook |
| Review SLA breach | Oldest-first queue, SLA timers, alerts, reviewer capacity planning |
| Taxonomy errors | Admin-managed reference data, stable codes, audit, staged rollout |
| Performance at scale | Indexed search, bounded candidate sets, materialised recommendations, CDN, Redis cache, load tests |
| PWA → Expo drift | Shared `packages/core`, platform adapters, contract tests, no browser APIs in domain code |

### Resolved decisions and remaining open questions

| # | Question | Decision |
|---|---|---|
| 1 | Exact Dhobi/Rajaka caste and sub-caste seed list, including synonyms and regional variants | **Resolved:** the client supplies the list later; it is seeded into the database through a versioned seed. Build the taxonomy, stable codes and admin management now. |
| 2 | INR price points, plan durations, and whether a free trial exists | **Resolved for launch:** everything is free during the launch trial. Billing, plans and entitlements stay modular and configuration-driven so any feature can be made paid later without feature-code changes. INR prices are required before billing is enabled. |
| 3 | Final age policy (18 for all versus 21 for men and 18 for women) | **Resolved:** men 21+, women 18+. Enforced server-side and re-checked against the ID. |
| 4 | KYC provider selection and per-verification cost ceiling | **Resolved for launch:** no third-party provider. An admin manually verifies the member's photo and government ID proof. Keep `KycProvider` with a `ManualKycProvider` default; a managed provider can be added later. |
| 5 | Data retention durations for ID images, messages, OTP logs, audit logs and deleted accounts | **Resolved:** 24-month retention/consent cycle. When it expires, the member is asked to consent again. Consent records are versioned and store the exact consent text, user name, IP, timestamp, user agent and expiry; consent is granted through the API and the current consent documents are seeded. Statutory financial/audit retention overrides the 24-month window where the law requires it. |
| 6 | Review-team staffing and hours, and whether the 48-hour promise is calendar or business hours | **Open (TBD):** assume one reviewer per shift and a calendar-hour SLA until confirmed. |
| 7 | Whether biodata is available immediately after submission or only after approval | **Resolved:** biodata is available only after admin approval. |
| 8 | Whether chat requires mutual interest only, or mutual interest plus Prime | **Open (TBD):** keep the server-side eligibility rule configurable (mutual match only vs mutual match + Prime). Default remains mutual match + Prime on at least one side. |
| 9 | Moderation policy for pre-wedding/engagement photos and family photos in the gallery | **Open (TBD):** keep the policy in admin configuration; default is the same moderation queue as other gallery photos, with a manual decision. |
| 10 | Grievance officer details, legal entity, registered address and DPDP notices | **Open (TBD):** placeholder content until the legal details are supplied; the fields and pages exist. |
| 11 | Web Push VAPID key ownership and the fallback policy for iOS users who decline installation | **Resolved (recommended default):** the platform owns one VAPID key pair per environment, stored in the secret manager and rotated with overlap. Push is best-effort; iOS members who do not install the PWA receive in-app notifications plus SMS/email for critical events (approval, rejection, interest, message). See the detailed explanation below. |
| 12 | When the Expo migration is triggered (feature parity, install base, or revenue threshold) | **Resolved:** Expo starts after the entire PWA is complete. |

#### Question 11 in detail — VAPID ownership and the iOS fallback

**What VAPID is.** Web Push needs a VAPID (Voluntary Application Server Identification) key pair. The public key is shipped to the browser and used to create a push subscription; the private key signs the push request so the push service (FCM, Mozilla, Apple) can verify that the message really comes from this application. Anyone holding the private key can send notifications to your subscribers, so it is a secret.

**Ownership.** The platform owns the key pair, not an individual developer or a third-party vendor. One pair per environment (`dev`, `staging`, `production`) so a development key can never notify production devices. Keys live in the secret manager and are injected into the notification service at runtime; they are never committed to git, bundled into the PWA or shared with the admin panel. Rotation uses an overlap window: publish the new public key, keep accepting subscriptions made with the old key, re-subscribe active devices, then retire the old private key. The public key is exposed through a configuration endpoint so the PWA can subscribe without hardcoding it.

**Subscription lifecycle.** A subscription is stored per device/browser endpoint, tied to the member and the installation. It is refreshed on permission grant and on `pushsubscriptionchange`; it is removed on logout, on permission revocation and when the push service reports it expired. One member can have several subscriptions (phone, tablet, desktop). The backend prunes endpoints that return `404`/`410` and records delivery status per attempt.

**iOS reality.** On iOS 16.4+ Web Push works only for a PWA added to the Home Screen; Safari in a normal tab cannot receive it. Installation is therefore a product step, not an afterthought: show a contextual install prompt after onboarding, explain the benefit, and never block the member on it.

**Fallback policy.** Push is treated as best-effort on every platform, not as a guaranteed channel:

1. Every notification is always written to the in-app notification centre first. This is the source of truth.
2. Critical events — approval, rejection, changes requested, new interest, accepted interest, new message, payment outcome, security alert, deletion scheduled — also go by SMS and/or email according to the member's preferences and contact data.
3. Non-critical events (profile views, shortlist reminders, digests) stay in-app/email and are not escalated to SMS.
4. If a member declines the install prompt or notification permission, the app explains what they will miss and keeps the in-app centre plus SMS/email fallback active. It does not repeatedly nag.
5. Delivery is asynchronous through BullMQ with retries, idempotency keys and a dead-letter queue. A failed push never fails the underlying business action.
6. The admin delivery dashboard shows push subscription counts, delivery/failure rates by platform and the fallback rate, so the team can see whether iOS members are reachable.

**Why this is the right default.** It keeps the private key under platform control, makes rotation and multi-environment deployment safe, avoids a hard dependency on a vendor, and guarantees that a member on an iPhone who never installs the PWA still learns about the events that matter.

### Glossary

- **PWA** — progressive web app; an installable web application with offline capability and push notifications.
- **Profile ID** — public, searchable, immutable identifier for a member profile.
- **Biodata** — shareable PDF summary of a profile, including family, education, career, horoscope and preferences.
- **Guna Milan** — 36-point Vedic compatibility assessment across eight kootas.
- **Manglik** — astrological condition based on Mars placement, relevant to horoscope matching.
- **Gotra** — patrilineal clan lineage used in Hindu marriage matching.
- **Prime** — paid membership tier unlocking contact details, chat and premium discovery.
- **Elite / Assisted** — high-touch tier with a relationship manager and curated introductions (Phase 3).
- **Reverse match** — a candidate whose preferences match the viewer's profile.
- **SLA** — service-level target, here the 24–48 hour profile review promise.
- **Shared core** — the framework-agnostic `packages/core` layer reused by the PWA and, later, Expo.
