# 04 — Media, Verification and Approval

## 1. Scope

This appendix covers:
1. Profile photo upload and moderation.
2. Government ID verification (manual admin comparison of member photo and ID proof at launch; OCR, face match and liveness when a managed provider is enabled; age check).
3. Admin review and the profile approval workflow.
4. Retention, audit and member communication.

## 2. Media upload pipeline

### 2.1 Upload flow

1. Client requests a presigned upload URL from `POST /media/upload-url` with `{ purpose, contentType, sizeBytes, fileName }`.
2. Server validates purpose, MIME type, size and quota, then returns a short-lived presigned URL and a media ID.
3. Client uploads directly to object storage (no file bytes through the API).
4. Client calls `POST /media/complete` with the media ID and checksum.
5. Server verifies the object exists, checks size/MIME/hash, enqueues processing, and returns `pending`.
6. Worker downloads, virus-scans, strips EXIF, re-encodes, generates responsive variants and a perceptual hash.
7. Auto-moderation runs (safe-search / nudity / violence / text-in-image checks).
8. Result: `approved`, `needsReview` or `rejected`; the member is notified.
9. Only `approved` media is served in profiles.

### 2.2 Photo constraints

| Rule | Value |
|---|---|
| Formats | JPEG, PNG, WebP |
| Max size | 10 MB |
| Min dimensions | 400 × 400 px |
| Max dimensions | 8000 × 8000 px (downscaled after upload) |
| Gallery size | 1–10 photos |
| Primary photo | Exactly one |
| Content | Face clearly visible; no group photos as primary; no celebrities; no contact details/watermarks; no nudity; no minors |
| Variants | 320, 640, 1080 px, WebP + JPEG fallback |
| Metadata | EXIF stripped (including GPS) |
| Storage | Private bucket; signed URLs with 5–15 minute TTL |
| Duplicate detection | Perceptual hash compared against the platform index |

### 2.3 Photo states

`pending` → `processing` → `approved` | `needsReview` | `rejected`

- `pending`: uploaded, not yet processed.
- `processing`: worker running.
- `approved`: safe and visible (subject to privacy settings).
- `needsReview`: auto-moderation uncertain; hidden until an admin decides.
- `rejected`: policy violation or unusable; hidden; owner sees the reason and can re-upload.

### 2.4 PWA capture guidance

- Selfie: front camera via `getUserMedia`; oval guide; good-light message; capture button; retake.
- Document: rear camera via `capture="environment"` file input; corner guides; avoid glare; capture both sides where required.
- Fallback: file upload from the gallery.
- Client-side pre-checks: dimensions, size, blur estimate; warn before upload.
- iOS Safari may suspend the camera when the tab backgrounds; re-acquire on visibility change.
- No image is written to local storage; only an in-memory preview and the uploaded media ID.

### 2.5 Acceptance criteria

- No file bytes pass through the NestJS API.
- A rejected photo never appears on a public profile.
- EXIF/GPS is absent from every stored variant.
- Duplicate photos are flagged before approval.
- The primary photo cannot be deleted if it is the only approved photo and the profile is under review.

## 3. Government ID verification

### 3.1 Accepted documents

| Type | Code | Notes |
|---|---|---|
| Aadhaar | `aadhaar` | Mask number to last 4; accept masked Aadhaar |
| PAN | `pan` | Name and DOB/DOB-derived age |
| Driving licence | `drivingLicence` | Check expiry |
| Ration card | `rationCard` | Name/photo/DOB where present |
| Election/Voter ID | `voterId` | Name/photo/DOB where present |
| Other | `other` | Manual review only |

### 3.2 Pipeline

**Launch path — manual admin verification (default):**

```
notStarted
  → consentGiven
  → documentUploaded (member photo + government ID proof)
  → manualReview (admin compares photo, name, DOB, expiry and document validity)
  → manualApproved | manualRejected | needsChanges
```

**Managed-provider path — later, behind the same `KycProvider` interface:**

```
notStarted
  → consentGiven
  → documentUploaded
  → documentProcessed (OCR + type/expiry/quality)
  → selfieCaptured
  → faceMatched
  → ageChecked
  → nameMatched
  → passed | needsReview | failed
```

Each step writes a timestamp, actor (member, admin or provider), redacted response, score where available and error code. At launch the automated steps are skipped and the admin decision is the only source of `manualApproved`.

### 3.3 Checks and thresholds

| Check | Method | Pass threshold (configurable) | On failure |
|---|---|---|---|
| Document type | Provider classification | Accepted list | Ask for an accepted type |
| Readability | OCR confidence + blur score | OCR ≥ 0.80, blur below limit | Retry with clearer image |
| Expiry | Parsed expiry date | Not expired | Ask for a valid document |
| DOB / age | Admin reads DOB from the ID + server age gate | Men ≥ 21, women ≥ 18 | Block with a clear legal message |
| Name match | Fuzzy match OCR name vs profile name | Similarity ≥ 0.85 | Manual review |
| Face match | ID photo vs selfie | Score ≥ 0.80 | Retry selfie; then manual review |
| Profile photo match | Selfie vs primary profile photo | Score ≥ 0.75 | Manual review or photo re-upload |
| Liveness | Provider challenge/score | Provider pass | Retry; repeated failure → manual review |
| Duplicate ID | Hash of document number | No other account | Manual review / fraud queue |
| Screen/print detection | Provider | No screen/print | Reject with guidance |

Thresholds live in configuration and can be tuned without a release. A failed check never reveals which specific biometric threshold failed; the member sees actionable guidance.

At launch the automated checks in the table are not run. `ManualKycProvider` routes every case to an admin, who performs the same checks by eye: document type, readability, expiry, DOB/age, name match, photo match and duplicate ID. The thresholds become active only when a managed provider is enabled.

### 3.4 Verification states (member-visible)

| Status | Meaning | Member can submit? |
|---|---|---|
| `notStarted` | No document | No |
| `uploaded` | Document received | No |
| `processing` | Checks running | No |
| `passed` | All checks passed | Yes |
| `needsReview` | Ambiguous; waiting for admin | No |
| `failed` | Clear failure | No; retry allowed |
| `manualApproved` | Admin accepted | Yes |
| `manualRejected` | Admin rejected | No; support/appeal |

### 3.5 Retry and escalation

- A member may retry a failed verification up to 3 times in 24 hours.
- After 3 failures, the case goes to manual review and self-service retry is paused.
- Document quality failures show specific capture guidance; identity mismatches show a neutral message and route to review.
- A member can appeal a manual rejection through support; the appeal is a new review item with the prior history attached.

### 3.6 Launch implementation — manual admin KYC

`ManualKycProvider` implements the same interface as a managed provider:

- `createSession` returns a local session ID; there is no hosted redirect.
- `submitDocument` stores the government ID proof and marks the case `needsReview`.
- `submitSelfie` stores the member-selected photo.
- `getResult` returns `needsReview` until an admin decides.
- `parseWebhook` is a no-op.

The admin workspace shows the member photo, ID photo, typed name/DOB and the member's profile side by side. The admin approves, rejects or requests changes with a reason code. The member sees "Manually verified by an admin" and the decision date. No OCR, face-match or liveness score is produced, and no third-party cost is incurred.

### 3.7 Provider adapter

```ts
interface KycProvider {
  createSession(input: { userId: string; language: string }): Promise<{ sessionId: string; redirectUrl?: string }>;
  submitDocument(input: { sessionId: string; mediaId: string; side: 'front' | 'back' }): Promise<DocumentResult>;
  submitSelfie(input: { sessionId: string; mediaId: string }): Promise<SelfieResult>;
  getResult(sessionId: string): Promise<VerificationResult>;
  parseWebhook(payload: unknown, signature: string): VerificationResult;
}
```

- The PWA may use the provider's hosted web capture page for stronger liveness; the backend still receives and stores the result.
- A `FakeKycProvider` returns deterministic results in tests.
- Provider raw payloads are stored redacted for audit; raw images follow the retention policy.

### 3.8 Acceptance criteria

- A member cannot reach `manualApproved` without a member photo, government ID proof and an explicit admin decision.
- A member cannot reach `passed` without document, selfie, face match and age check when a managed provider is enabled.
- The server recalculates age from the verified DOB and blocks under-age accounts (men 21+, women 18+).
- ID numbers are encrypted and masked; no API returns the full number to a non-admin.
- The same document number cannot verify two active accounts without review.
- Repeated failures route to manual review rather than permanent rejection.
- Provider downtime degrades to `needsReview`, not a hard failure.

## 4. Admin review

### 4.1 Queue

- Ordered oldest-first.
- Columns: profile ID, name, submitted time, SLA remaining, verification status, photo status, risk flags.
- Filters: status, verification result, risk flag, language, reviewer, date.
- Bulk actions only for safe operations (assign reviewer, add tag); approval is always individual.

### 4.2 Review workspace

| Panel | Contents |
|---|---|
| Summary | Photo, name, age, city, community, profile completeness, membership |
| Sections | Personal, religious, location, education, career, family, lifestyle, preferences, prompts |
| Verification | ID front/back, member photo, member-entered name/DOB, optional OCR/face scores when a provider is enabled, admin decision |
| Photos | Gallery with moderation status and rejection reasons |
| History | Submission snapshots, prior decisions, edits, reports, account actions |
| Decision | Approve, Request changes, Reject; reason code; notes; notify toggle |

### 4.3 Decisions

| Decision | Effect | Member message |
|---|---|---|
| Approve | Profile `approved`, account `active`, badges applied | "Your profile is verified." |
| Request changes | Profile `needsChanges`; flagged sections listed | Specific corrections with deep links |
| Reject | Profile `rejected`; reason shown | Reason + appeal/support path |
| Suspend | Profile `suspended`; hidden | Policy reason; appeal path |
| Ban | Account `blocked`; all sessions revoked | Policy reason; support path |

**Reason codes (seed):** unreadable document, expired document, name mismatch, photo mismatch, under-age, prohibited content, incomplete profile, duplicate account, suspicious activity, terms violation, other.

### 4.4 SLA

- Clock starts at submission and restarts on resubmission.
- Target: median ≤ 24 hours, 95th percentile ≤ 48 hours.
- At 36 hours the item is highlighted; at 48 hours an alert fires to the ops channel.
- SLA is calendar hours for the launch; business-hours policy is configurable.
- Admin dashboards show queue depth, age distribution and reviewer throughput.

### 4.5 Audit

Every admin action writes an immutable `AdminAuditLog` entry:

- admin ID, role, IP, user agent;
- action type (`viewDocument`, `approveProfile`, `rejectProfile`, `requestChanges`, `suspend`, `ban`, `restore`, `overrideField`, `grantPlan`, `refund`, `exportData`, `deleteData`);
- target user/profile ID;
- reason code and note;
- before/after status;
- timestamp and request ID.

Document views are logged separately with the document ID and duration. Audit records are append-only and exportable by a super admin.

## 5. Member communication

| Event | Channels | Timing |
|---|---|---|
| Verification passed | In-app, push, email | Immediate |
| Verification failed | In-app, push, email | Immediate, with guidance |
| Verification needs review | In-app, email | Immediate |
| Profile submitted | In-app, push, SMS, email | Immediate |
| Changes requested | In-app, push, SMS, email | Immediate |
| Profile rejected | In-app, push, SMS, email | Immediate |
| Profile approved | In-app, push, SMS, email | Immediate |
| Review SLA breach | Internal ops alert | At 48h |
| Document retention deletion | In-app, email | 7 days before |

All member-facing messages use the member's language and never include raw document data.

## 6. Data retention

| Data | Retention | Notes |
|---|---|---|
| Raw ID images | 24 months after decision (configurable) | Deleted by scheduled job; hash retained |
| Manual review results | 24 months | Audit and dispute handling |
| Document number | Encrypted; last 4 retained | Full number deleted with images |
| Member photo / selfie | 24 months after decision | Same job |
| Rejected photos | 30 days | Appeal window |
| Approved photos | Until profile/photo deletion | Served via signed URLs |
| Submission snapshots | 24 months | Audit and disputes |
| Audit logs | 24 months, or longer where law requires | Legal/financial |
| Consent records | 24 months from grant, then re-consent | Versioned evidence; statutory retention overrides |

At the end of the 24-month window the member is asked to re-consent through the API. The consent record stores the exact text shown, document version and hash, user name, IP, user agent, grant/expiry timestamps and source. If the member declines, the documented consequence applies (verification and visibility stop, then deletion is scheduled). Retention values are configuration and must be reflected in the privacy policy.

## 7. Failure modes

| Failure | Behaviour |
|---|---|
| Storage unavailable | Upload returns retryable error; client keeps the local file reference until success |
| Virus detected | Media rejected, member notified, security team alerted |
| Moderation provider down | Media stays `pending`/`needsReview`; profile submission blocked only if no approved photo exists |
| KYC provider timeout (when a managed provider is enabled) | Status `needsReview`; retry job; member told it is delayed |
| Admin or OCR misreads DOB | Second reviewer required before a DOB-based rejection; never auto-reject on a single signal |
| Admin accidentally approves | Super admin can suspend within the audit window; member notified |
| Duplicate ID detected | Case routed to fraud queue; no automatic ban |
| Retention job fails | Alert; retry; compliance dashboard shows overdue items |

## 8. Acceptance checklist

- [ ] Presigned uploads only; no file bytes through the API.
- [ ] Virus scan, EXIF strip, re-encode, variants and perceptual hash run for every image.
- [ ] Auto-moderation plus human review for uncertain content.
- [ ] One approved primary photo required before submission.
- [ ] ID pipeline records every step, actor and score where available.
- [ ] At launch, an admin manually compares the member photo and ID proof; no automated pass is possible.
- [ ] Age is verified from the document and re-checked server-side (men 21+, women 18+).
- [ ] Consent records store the exact text, version, user name, IP, timestamp and expiry.
- [ ] Name/face mismatch routes to manual review, not automatic rejection.
- [ ] Retry limits and manual escalation work.
- [ ] Admin decisions require a reason and write an audit record.
- [ ] Document views are audited.
- [ ] Retention jobs delete raw documents on schedule.
- [ ] Member notifications use the member's language and contain no raw document data.
