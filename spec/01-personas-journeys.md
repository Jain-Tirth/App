# 01 — Personas and Journeys

## 1. Personas

### P1 — Self-seeking member

- **Who:** 24–34, Dhobi/Rajaka, working or studying, smartphone-first, financially independent.
- **Goals:** Find a compatible partner without family pressure becoming the whole process; control privacy; avoid fake profiles.
- **Pains:** Generic apps do not understand sub-caste/gotra; too many irrelevant profiles; harassment after sharing a number.
- **Needs:** Fast onboarding, strong filters, verified badges, private chat, a profile that expresses personality.
- **Success:** Receives a quality interest or match within the first week.

### P2 — Parent/guardian manager

- **Who:** 45–62, parent or close relative, less comfortable with complex apps, often managing the profile on behalf of a son or daughter.
- **Goals:** Present the family accurately, find culturally suitable matches, verify the other side.
- **Pains:** Long forms, English-only interfaces, unclear what is mandatory, fear of scams.
- **Needs:** Gujarati/Hindi, "profile created for" clarity, family sections, assisted support, simple navigation.
- **Success:** Completes a profile and shortlists 3–5 candidates with confidence.

### P3 — NRI/diaspora member

- **Who:** 26–38, community member living in the Gulf, UK, US, Canada or Australia.
- **Goals:** Find a partner who is open to relocating or is already abroad; verify intent.
- **Pains:** Time zones, fake NRI profiles, unclear visa/resident status, payment friction.
- **Needs:** Citizenship/resident status fields, location filters, video calling (Phase 3), international payment options (Phase 4).
- **Success:** Matches with a like-minded NRI or a partner open to relocation within a month.

### P4 — Prime member

- **Who:** Approved member who has decided to invest in the search.
- **Goals:** Contact the right people, chat safely, see who viewed them, get better visibility.
- **Pains:** Paying without a clear entitlement list; renewal surprises; refund friction.
- **Needs:** Transparent plans, reliable payments, contact reveal, chat, invoices, easy cancellation.
- **Success:** Converts a match into an offline meeting.

### P5 — Admin reviewer

- **Who:** Back-office reviewer, trained on verification and policy.
- **Goals:** Clear the queue within SLA, catch fraud, avoid false rejections.
- **Pains:** Slow tools, unclear evidence, repetitive decisions, no audit trail.
- **Needs:** Side-by-side member photo and ID proof, member-entered name/DOB, optional OCR and face-match scores when a provider is enabled, reason codes, keyboard shortcuts, SLA timer.
- **Success:** Reviews 40–60 profiles per shift with < 2% error.

### P6 — Support agent

- **Who:** Member-support staff handling login, verification, payment and safety issues.
- **Goals:** Resolve tickets quickly without engineering help.
- **Pains:** No member context, no audit history, manual refunds.
- **Needs:** Member search, profile and verification history, plan status, refund action, canned responses.
- **Success:** First-response < 12 hours, resolution < 48 hours.

### P7 — Content moderator

- **Who:** Trust and safety staff reviewing photos, reports and messages.
- **Goals:** Remove harmful content quickly and consistently.
- **Pains:** Ambiguous policy, no evidence, no escalation path.
- **Needs:** Photo queue, report evidence, policy reasons, escalation, audit.
- **Success:** Harmful content removed before it is widely seen; low appeal overturn rate.

### P8 — Relationship manager (Phase 3)

- **Who:** Matchmaking consultant for Elite members.
- **Goals:** Curate high-quality introductions and coordinate meetings.
- **Pains:** No curated workspace, no member context, manual coordination.
- **Needs:** Assigned member list, curated shortlists, notes, meeting scheduler, consent tracking.
- **Success:** Elite member receives 3 curated introductions per month.

## 2. Journeys

### J1 — New self-member: first visit to approved profile

| Step | Screen | Member action | System action |
|---|---|---|---|
| 1 | Landing | Opens link, sees community promise | Detects language, offers install later |
| 2 | Language | Chooses Hindi/Gujarati/English | Persists preference locally and on account |
| 3 | Welcome | Taps Create Profile | Routes to profile-created-for |
| 4 | Profile created for | Selects "Myself" | Stores intent |
| 5 | Account basics | Enters name, email, password, mobile, accepts terms/consent | Validates, checks uniqueness, sends OTP |
| 6 | OTP | Enters 6-digit code | Verifies, creates session, creates draft profile |
| 7 | Onboarding hub | Sees sections and completion | Prefills known data, shows required markers |
| 8 | Personal | Enters gender, DOB, height, weight, marital status, languages | Computes age, enforces 21+ for men and 18+ for women, saves |
| 9 | Religious | Selects religion, community, sub-caste, gotra, dosh, manglik | Saves, updates completion |
| 10 | Location | Selects country/state/city, resident status | Saves |
| 11 | Education | Adds highest degree and optional history | Saves |
| 12 | Career | Adds employment, occupation, income | Saves |
| 13 | Family | Adds family type, values, parents, siblings | Saves |
| 14 | Lifestyle | Adds diet, smoking, drinking, hobbies | Saves |
| 15 | About | Writes bio, answers prompts, picks interests | Saves |
| 16 | Partner preferences | Sets age, height, community, location, education, career | Saves, computes match preview |
| 17 | Photos | Uploads primary photo and gallery | Uploads, moderates, shows status |
| 18 | Contact | Adds optional alternates, sets visibility | Saves, masks by default |
| 19 | Horoscope | Adds birth time/place, optional janampatri | Computes or stores details |
| 20 | Verify | Selects/uploads a photo and government ID proof, consents | Queues for manual admin comparison of photo, name, DOB and document validity |
| 21 | Review | Sees summary and completeness | Validates mandatory fields and verification |
| 22 | Submit | Taps Submit | Creates submission snapshot, sets Under Review, notifies |
| 23 | Pending | Sees 24–48h message | Blocks main app, shows status |
| 24 | Decision | Receives push/SMS/email | Sets Approved or Needs Changes/Rejected |
| 25 | Home | Enters app after approval | Loads recommendations, shows badges |

**Failure branches:** OTP expired (resend), OTP locked (wait/contact support), age below the gender-specific minimum (block with explanation), photo rejected (re-upload guidance), ID unreadable (retry/manual review), profile incomplete (highlight missing), verification failed repeatedly (manual review), admin requests changes (edit specific sections and resubmit).

### J2 — Parent-managed profile

1. Parent selects "Son" or "Daughter" in profile-created-for.
2. Parent enters the child's name, but the account email/mobile may be the parent's or the child's; the relationship is explicit.
3. The profile labels "Created by: Parent" and the member's own contact remains private.
4. The child can later claim the profile by verifying their own mobile/email and accepting a transfer; until then, the parent manages it.
5. All notifications go to the managing account; the profile displays the relationship honestly.
6. Admin review checks that the person in the photo matches the ID and that the managing relationship is plausible.

### J3 — NRI member

1. Selects country of residence outside India; state/city become free-text or a country-specific list.
2. Adds citizenship, resident status and "interested in settling abroad".
3. Sees location filters for country/city and "open to relocate".
4. Matches with local and India-based members who are open to relocation.
5. Uses chat/contact reveal; video calling arrives in Phase 3.
6. Payment via Razorpay international cards at launch; local methods later.

### J4 — Rejected / needs-changes recovery

1. Member receives a decision with a reason code and message.
2. The pending screen shows exactly what to fix, with deep links to the relevant sections.
3. Member edits only the flagged sections; verification may be reused if still valid.
4. Member resubmits; the submission history records the prior decision and the new snapshot.
5. Admin sees the history and the diff; the SLA restarts from resubmission.

### J5 — Discovery to conversation

1. Member opens Home and sees up to 9 daily recommendations.
2. Taps a card to view the full profile: photos, personal, professional, family, lifestyle, horoscope, preferences.
3. Sees compatibility reasons and a match count.
4. Taps Send Interest; the other member is notified.
5. Receiver accepts or declines; acceptance creates a mutual match.
6. If both are Prime, chat unlocks; otherwise the contact reveal paywall is shown.
7. Chat starts with a safety notice; either side can report or block.
8. Conversation can move to a call (Phase 3) or an offline meeting.

### J6 — Upgrade to Prime

1. Free member hits a locked action (contact reveal, chat, who-viewed).
2. Paywall explains the exact entitlement and shows plan options.
3. Member chooses a plan and pays via Razorpay checkout.
4. Backend verifies the signature and webhook, grants the entitlement, and shows a success state.
5. Member returns to the locked action, which now works.
6. Renewal reminder is sent before the next charge; cancellation is available in Settings.

### J7 — Admin review

1. Reviewer opens the queue, oldest first, with SLA badges.
2. Selects a profile; the workspace shows the profile summary, section tabs and verification panel.
3. Compares the ID and member photo side by side; reviews name/DOB and the age check, plus OCR/face-match scores when a provider is enabled.
4. Checks photo moderation results and any red flags.
5. Chooses Approve, Request Changes or Reject; selects a reason and adds notes.
6. The member is notified; the audit log records the decision and duration.
7. If the SLA is at risk, the queue highlights it and an alert fires.

### J8 — Safety report

1. Member reports a profile or message, selects a reason, adds evidence.
2. The reported content is hidden from the reporter immediately.
3. A moderation ticket is created with priority based on reason.
4. Moderator reviews evidence and takes action: dismiss, warn, hide, suspend or ban.
5. Both parties receive an outcome notification where appropriate.
6. Every action is audited; repeat offenders trigger stricter controls.

### J9 — Account deletion

1. Member requests deletion in Settings.
2. The app explains what will be deleted, what must be retained (financial/audit), and the cooling-off period.
3. Member confirms with OTP/password.
4. Account is deactivated immediately and hidden from discovery.
5. After the cooling-off period, PII is deleted or irreversibly anonymised; audit and financial records remain as required.
6. A confirmation is sent.

## 3. Journey edge cases

| Case | Expected behaviour |
|---|---|
| Member changes language mid-onboarding | UI switches instantly; saved data is untouched |
| Member loses network during photo upload | Upload retries; draft is preserved; clear error |
| Member installs PWA after registering | Session persists; install prompt not shown again |
| Member uses two devices | Refresh token rotation; old session revoked on logout-all |
| Member edits a one-time field twice | Blocked with an explanation and support link |
| Member's ID verification passes but photo is rejected | Submission blocked with photo-specific guidance |
| Admin approves while member is editing | Member sees approved status; edits create a post-approval update, not a resubmission |
| Member deletes account during review | Review is cancelled; account hidden; deletion follows policy |
| Payment succeeds but webhook is delayed | Client polls order status; entitlement granted on webhook or reconciliation |
| Payment succeeds but client closes | Webhook grants entitlement; member sees it on next open |
| Report filed against a mutual match | Chat is frozen pending review; both parties notified appropriately |
