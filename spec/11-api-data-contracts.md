# 11 — API and Data Contracts

## 1. Conventions

| Concern | Rule |
|---|---|
| Base path | `/api/v1` (the existing unprefixed routes are migrated behind the prefix with a compatibility window) |
| Transport | HTTPS, JSON |
| Naming | camelCase in JSON, snake_case in SQL, PascalCase for tables |
| IDs | UUID v4 for internal IDs; public `profileUid` for shareable profile IDs |
| Timestamps | ISO-8601 UTC (`2026-11-09T10:15:30.000Z`) |
| Dates | `YYYY-MM-DD`; times `HH:mm` in the member's stored time zone context |
| Money | Integer minor units plus ISO currency (`{ amountMinor, currency }`) |
| Pagination | Cursor for feeds (`cursor`, `limit`); offset only for admin tables (`page`, `pageSize`) |
| Filtering | Repeated query params or comma-separated codes; documented per endpoint |
| Sorting | `sort` enum, never raw SQL |
| Idempotency | `Idempotency-Key` header on POST for orders, submissions, uploads, reports |
| Versioning | Path version; breaking changes require `/v2` and a deprecation window |
| Localization | `Accept-Language: en\|hi\|gu`; responses include localized labels where relevant |
| Request ID | `X-Request-Id` echoed and included in error envelopes |
| Auth | `Authorization: Bearer <accessToken>`; refresh via secure cookie |
| Admin auth | Separate token audience and cookie scope |

### 1.1 Response envelope

Single resources return the object directly. Collections return:

```json
{
  "data": [],
  "pageInfo": { "nextCursor": "string|null", "hasMore": true },
  "requestId": "uuid"
}
```

Errors:

```json
{
  "error": {
    "code": "PROFILE_INCOMPLETE",
    "message": "Human-readable, localized message",
    "details": [{ "field": "heightCm", "code": "OUT_OF_RANGE", "message": "..." }],
    "requestId": "uuid"
  }
}
```

- `code` is stable and machine-readable.
- `message` is safe to show; it never contains stack traces, SQL or provider internals.
- Validation errors list every field issue.
- `401` for unauthenticated, `403` for unauthorized, `404` for not found or hidden, `409` for conflicts, `422` for validation, `429` for rate limits, `5xx` for server faults.

## 2. Existing API surface (baseline)

The current backend exposes these routes. They are retained and extended; the spec does not remove capability.

### Auth (`/auth`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Create account, send OTP |
| POST | `/auth/otp/resend` | Resend OTP |
| POST | `/auth/otp/verify` | Verify OTP, issue session |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke session |

### Profiles (`/profiles`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/profiles/me` | Current member profile |
| GET | `/profiles/matches` | Basic match list |
| PUT | `/profiles/step-1` | Personal details |
| PUT | `/profiles/step-2` | Religious details |
| PUT | `/profiles/step-3` | Location details |
| PUT | `/profiles/step-4` | Professional details |
| PUT | `/profiles/step-5` | Family/lifestyle bio |

### Admin (`/admin`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/admin/login` | Admin login |
| GET | `/admin/stats` | Dashboard stats |
| GET | `/admin/profiles/pending` | Pending queue |
| GET | `/admin/profiles/:userId` | Profile detail |
| PATCH | `/admin/profiles/:userId/approve` | Approve |
| PATCH | `/admin/profiles/:userId/reject` | Reject |

## 3. Target API catalogue

Endpoints marked **MVP**, **P2** or **P3** follow the roadmap in `13-roadmap.md`.

### 3.1 Auth and account

| Method | Path | Phase | Notes |
|---|---|---|---|
| POST | `/auth/register` | MVP | Extended with `profileCreatedBy`, consents, language |
| POST | `/auth/otp/resend` | MVP | Channel `sms\|email` |
| POST | `/auth/otp/verify` | MVP | Returns access token + sets refresh cookie |
| POST | `/auth/login` | MVP | Email/password |
| POST | `/auth/login/mobile` | P2 | Mobile + OTP login |
| POST | `/auth/refresh` | MVP | Rotating refresh |
| POST | `/auth/logout` | MVP | Current session |
| POST | `/auth/logout-all` | MVP | All sessions |
| POST | `/auth/password/forgot` | MVP | Email reset link |
| POST | `/auth/password/reset` | MVP | Single-use token |
| POST | `/auth/email/verify` | P2 | Email OTP |
| GET | `/account/me` | MVP | Account, status, language, memberships |
| PATCH | `/account/me` | MVP | Language, notification prefs, privacy defaults |
| POST | `/account/consents` | MVP | Record consent with document version and exact text hash |
| GET | `/account/consents` | MVP | Consent history |
| GET | `/account/consents/current` | MVP | Current documents, versions and expiry |
| POST | `/account/consents/renew` | MVP | Re-consent at the 24-month expiry |
| POST | `/account/export` | MVP | DPDP export request |
| POST | `/account/delete` | MVP | Deletion request |
| GET | `/account/sessions` | MVP | Active sessions |
| DELETE | `/account/sessions/:id` | MVP | Revoke a session |
| POST | `/account/push-subscriptions` | MVP | Register Web Push |
| DELETE | `/account/push-subscriptions` | MVP | Remove subscription |

### 3.2 Profile

| Method | Path | Phase | Notes |
|---|---|---|---|
| GET | `/profiles/me` | MVP | Full owner view with completion and status |
| PATCH | `/profiles/me` | MVP | Section-agnostic partial update where safe |
| PUT | `/profiles/step-1` | MVP | Personal |
| PUT | `/profiles/step-2` | MVP | Religious |
| PUT | `/profiles/step-3` | MVP | Location |
| PUT | `/profiles/step-4` | MVP | Professional |
| PUT | `/profiles/step-5` | MVP | Family/lifestyle |
| PUT | `/profiles/education` | MVP | Education |
| PUT | `/profiles/about` | MVP | About, looking for, prompts, interests |
| PUT | `/profiles/preferences` | MVP | Partner preferences |
| PUT | `/profiles/contact` | MVP | Contact and visibility |
| PUT | `/profiles/horoscope` | MVP | Horoscope |
| PUT | `/profiles/privacy` | MVP | Privacy settings |
| GET | `/profiles/completion` | MVP | Server-computed percentage and missing fields |
| POST | `/profiles/submit` | MVP | Submit for review |
| POST | `/profiles/withdraw` | MVP | Withdraw submission |
| GET | `/profiles/status` | MVP | Status and reasons |
| GET | `/profiles/:profileUid` | MVP | Public profile, authorization-filtered |
| GET | `/profiles/:profileUid/compatibility` | P2 | Score and reasons |
| GET | `/profiles/me/biodata` | P2 | Generate/preview PDF; only after admin approval |
| POST | `/profiles/me/horoscope/recompute` | P3 | Recompute chart |

### 3.3 Media and verification

| Method | Path | Phase | Notes |
|---|---|---|---|
| POST | `/media/upload-url` | MVP | Presigned upload |
| POST | `/media/complete` | MVP | Finalize and enqueue processing |
| GET | `/media/:id` | MVP | Signed URL if authorized |
| DELETE | `/media/:id` | MVP | Soft delete |
| POST | `/profiles/me/photos` | MVP | Register a photo |
| PATCH | `/profiles/me/photos/:id` | MVP | Caption, order, primary, visibility |
| DELETE | `/profiles/me/photos/:id` | MVP | Delete photo |
| POST | `/verification/session` | MVP | Create KYC session |
| POST | `/verification/document` | MVP | Submit document media |
| POST | `/verification/selfie` | MVP | Submit selfie |
| GET | `/verification/status` | MVP | Current status and scores (safe subset) |
| POST | `/verification/retry` | MVP | Retry after failure |
| POST | `/verification/webhook` | MVP | Provider callback (signature-verified) |

### 3.4 Discovery

| Method | Path | Phase | Notes |
|---|---|---|---|
| GET | `/discovery/recommendations` | MVP | Daily feed |
| GET | `/discovery/reverse-matches` | P2 | Reciprocal matches |
| GET | `/discovery/new-matches` | P2 | Recently joined |
| GET | `/discovery/online` | P2 | Online now |
| GET | `/discovery/who-viewed-me` | P2 | Prime-only |
| GET | `/search/profiles` | MVP | Filters + cursor |
| GET | `/search/suggestions` | P2 | Typeahead for city/occupation |
| POST | `/search/saved` | P2 | Save a search |
| GET | `/search/saved` | P2 | List saved searches |
| DELETE | `/search/saved/:id` | P2 | Delete |
| POST | `/profiles/:profileUid/view` | MVP | Record a view |
| GET | `/taxonomy/:type` | MVP | Reference data by type |

### 3.5 Engagement

| Method | Path | Phase | Notes |
|---|---|---|---|
| POST | `/interests` | MVP | Send interest |
| GET | `/interests/sent` | MVP | Sent list |
| GET | `/interests/received` | MVP | Received list |
| POST | `/interests/:id/accept` | MVP | Accept |
| POST | `/interests/:id/decline` | MVP | Decline |
| POST | `/interests/:id/withdraw` | MVP | Withdraw |
| GET | `/shortlists` | MVP | Named lists |
| POST | `/shortlists` | MVP | Create list |
| PATCH | `/shortlists/:id` | MVP | Rename |
| DELETE | `/shortlists/:id` | MVP | Delete |
| POST | `/shortlists/:id/profiles` | MVP | Add profile |
| DELETE | `/shortlists/:id/profiles/:profileUid` | MVP | Remove |
| POST | `/hidden-profiles` | MVP | Ignore |
| DELETE | `/hidden-profiles/:profileUid` | MVP | Undo ignore |
| POST | `/blocks` | MVP | Block |
| DELETE | `/blocks/:profileUid` | MVP | Unblock |
| POST | `/reports` | MVP | Report profile/message |
| POST | `/contact/reveal` | P2 | Reveal contact if entitled |
| GET | `/contact/reveal/history` | P2 | Who revealed the owner's contact |

### 3.6 Messaging

| Method | Path | Phase | Notes |
|---|---|---|---|
| GET | `/conversations` | P2 | List with unread counts |
| GET | `/conversations/:id` | P2 | Conversation + messages page |
| POST | `/conversations` | P2 | Start conversation (eligibility enforced) |
| POST | `/conversations/:id/messages` | P2 | Send (REST fallback) |
| POST | `/conversations/:id/read` | P2 | Mark read |
| PATCH | `/conversations/:id` | P2 | Mute/close |
| DELETE | `/conversations/:id` | P2 | Delete for self |
| Socket | `message:send`, `message:new`, `message:read`, `typing:start`, `typing:stop` | P2 | Socket.io events |
| POST | `/video/token` | P3 | Agora room token |
| GET | `/events` | P3 | Live events |
| POST | `/events/:id/register` | P3 | Register for event |

### 3.7 Notifications

| Method | Path | Phase | Notes |
|---|---|---|---|
| GET | `/notifications` | MVP | In-app list |
| GET | `/notifications/unread-count` | MVP | Badge |
| POST | `/notifications/:id/read` | MVP | Mark read |
| POST | `/notifications/read-all` | MVP | Mark all |
| GET | `/notifications/preferences` | MVP | Per event × channel |
| PUT | `/notifications/preferences` | MVP | Update |
| POST | `/notifications/test` | MVP | Send a test push |

### 3.8 Billing

| Method | Path | Phase | Notes |
|---|---|---|---|
| GET | `/billing/plans` | P2 | Localized plans and prices |
| POST | `/billing/orders` | P2 | Create provider order |
| POST | `/billing/verify` | P2 | Verify client payment |
| POST | `/billing/webhook` | P2 | Provider webhook |
| GET | `/billing/membership` | P2 | Current membership |
| GET | `/billing/invoices` | P2 | Invoice list |
| GET | `/billing/invoices/:id` | P2 | Invoice PDF |
| POST | `/billing/cancel` | P2 | Cancel auto-renew |
| POST | `/billing/refund-request` | P2 | Request a refund |

### 3.9 Admin

| Method | Path | Phase | Notes |
|---|---|---|---|
| POST | `/admin/login` | MVP | MFA challenge |
| POST | `/admin/mfa/verify` | MVP | Complete login |
| GET | `/admin/stats` | MVP | Extended dashboard |
| GET | `/admin/profiles/pending` | MVP | Queue |
| GET | `/admin/profiles/:userId` | MVP | Workspace |
| PATCH | `/admin/profiles/:userId/approve` | MVP | Approve |
| PATCH | `/admin/profiles/:userId/reject` | MVP | Reject with reason |
| PATCH | `/admin/profiles/:userId/request-changes` | MVP | Flag sections |
| PATCH | `/admin/profiles/:userId/suspend` | P2 | Suspend |
| PATCH | `/admin/profiles/:userId/ban` | P2 | Ban |
| PATCH | `/admin/profiles/:userId/override-field` | P2 | One-time edit override |
| POST | `/admin/members/:userId/reset-verification` | P2 | Reset |
| POST | `/admin/members/:userId/resend-otp` | P2 | Resend |
| POST | `/admin/members/:userId/grant-plan` | P2 | Grant membership |
| POST | `/admin/members/:userId/refund` | P2 | Refund |
| GET | `/admin/reports` | P2 | Report queue |
| PATCH | `/admin/reports/:id` | P2 | Resolve |
| GET | `/admin/photos/pending` | P2 | Photo queue |
| PATCH | `/admin/photos/:id` | P2 | Moderate |
| GET | `/admin/tickets` | P2 | Support queue |
| PATCH | `/admin/tickets/:id` | P2 | Update |
| GET | `/admin/taxonomy/:type` | P2 | List |
| POST | `/admin/taxonomy/:type` | P2 | Create |
| PATCH | `/admin/taxonomy/:type/:code` | P2 | Update |
| GET | `/admin/plans` | P2 | Plans/prices |
| PUT | `/admin/plans/:code` | P2 | Edit |
| GET | `/admin/flags` | P2 | Feature flags |
| PUT | `/admin/flags/:key` | P2 | Update |
| POST | `/admin/broadcasts` | P2 | Send/schedule |
| GET | `/admin/audit` | P2 | Search audit |
| GET | `/admin/audit/export` | P2 | Export |
| GET | `/admin/data-requests` | P2 | DPDP queue |
| PATCH | `/admin/data-requests/:id` | P2 | Process |

## 4. Request and response examples

### 4.1 Send interest

```http
POST /api/v1/interests
Authorization: Bearer <token>
Idempotency-Key: 7f4c...
Content-Type: application/json

{ "profileUid": "DHB4268559", "message": "We share a love for classical music." }
```

```json
{
  "id": "uuid",
  "status": "pending",
  "receiver": { "profileUid": "DHB4268559", "displayName": "A. Sharma" },
  "createdAt": "2026-11-09T10:15:30.000Z",
  "expiresAt": "2026-12-09T10:15:30.000Z"
}
```

Errors: `409 INTEREST_ALREADY_PENDING`, `403 INTEREST_BLOCKED`, `402 PRIME_REQUIRED` (only when a note is included).

### 4.2 Search

```http
GET /api/v1/search/profiles?ageMin=24&ageMax=32&community=dhobi&city=Ahmedabad&verifiedOnly=true&sort=compatibility&limit=20
```

```json
{
  "data": [
    {
      "profileUid": "DHB4268559",
      "displayName": "A. Sharma",
      "age": 27,
      "heightCm": 165,
      "city": "Ahmedabad",
      "community": "Dhobi",
      "subcaste": "Rajaka",
      "education": "MCA",
      "occupation": "Software Engineer",
      "photo": { "url": "signed", "visibility": "everyone" },
      "badges": ["idVerified", "photoVerified"],
      "lastSeenAt": null,
      "compatibility": { "score": 82, "reasons": ["Same mother tongue"] }
    }
  ],
  "pageInfo": { "nextCursor": "opaque", "hasMore": true },
  "requestId": "uuid"
}
```

### 4.3 Submit profile

```http
POST /api/v1/profiles/submit
Idempotency-Key: 0b3d...
```

```json
{
  "profileStatus": "underReview",
  "submittedAt": "2026-11-09T10:15:30.000Z",
  "slaDueAt": "2026-11-11T10:15:30.000Z"
}
```

Errors: `422 PROFILE_GATES_FAILED` with a `details` array listing each unmet gate and a deep link.

### 4.4 Create order

```http
POST /api/v1/billing/orders
Idempotency-Key: 91ac...

{ "planPriceId": "uuid" }
```

```json
{
  "orderId": "uuid",
  "providerOrderId": "order_...",
  "amountMinor": 149900,
  "currency": "INR",
  "keyId": "rzp_...",
  "prefill": { "name": "A. Sharma", "email": "a@example.com", "contact": "+9198..." }
}
```

## 5. Authorization model

| Actor | Scope |
|---|---|
| `visitor` | Public marketing, registration, OTP, login, password reset |
| `member` | Own profile and drafts; approved members' public profiles; own interests, shortlists, chats, orders |
| `primeMember` | Member + entitled features |
| `eliteMember` | Prime + assisted features |
| `support` | Member context, tickets, resend OTP, reset verification, grant/refund within limits |
| `reviewer` | Review queue, documents, approve/request changes/reject, override fields |
| `moderator` | Photos, reports, hide content, suspend/ban within policy |
| `analyst` | Read-only aggregates; no documents or PII |
| `superAdmin` | All admin capabilities, settings, exports, deletion |

Rules:

- Ownership is checked from the authenticated principal, not the request body.
- The API returns `404` (not `403`) for resources the actor must not know exist, except where a clearer `403` is safe.
- Admin endpoints never accept a member token; member endpoints never accept an admin token.
- Entitlements are resolved on the server for every premium field and action.
- Tests assert the full matrix for every resource type.

## 6. Database changes

### 6.1 Existing tables (retained, extended)

`Users`, `UserSessions`, `Profiles`, `ProfilePersonal`, `ProfileReligious`, `ProfileLocations`, `ProfileProfessional`, `ProfileFamilyBio`, `ProfileLifestyle`, `ProfileHoroscope`, `PartnerPreferences` (+ `PartnerPrefReligious`, `PartnerPrefLocation`, `PartnerPrefCareer`), `ProfilePhotos`, `IdVerifications`, `Interests`, `Shortlists`, `HiddenProfiles`, `ProfileViews`, `DailyRecommendations`, `Conversations`, `Messages`, `Notifications`, `AppVersions`, `AdminAuditLog`.

**Logical-to-physical field mapping** (the field dictionary uses product language; the database keeps the existing names unless a migration explicitly renames them):

| Logical (spec) | Physical (existing) | Action |
|---|---|---|
| `fullName` | `Users.name` | Keep physical name; map in the API |
| `lastSeenAt` | `Users.lastSeen` | Keep physical name; map in the API |
| `membershipType: free` | `Users.membershipType: regular` | Extend enum; backfill `regular` → `free` |
| `community` | `ProfileReligious.caste` | Keep physical name; expose as "Community" |
| `languagesKnown` | `ProfilePersonal.spokenLanguages` | Keep physical name; map in the API |
| `dietaryHabits` | `ProfilePersonal.eatingHabits` | Keep physical name; map in the API |
| `motherTongue` | New column on `ProfilePersonal` | Additive migration |
| `heightCm`, `weightKg`, `maritalStatus`, `physicalStatus` | Same | No change |

### 6.2 Planned additions

| Table | Purpose |
|---|---|
| `ProfileEducation` | Degree history (post-grad, under-grad, school) |
| `ProfileAssets` | House/car ownership |
| `ProfilePrompts` | Prompt answers |
| `ProfileInterestTags` | Selected interests (join) |
| `ProfileSkills` | Hobbies/interests/music/books/sports/cuisine/movies (typed join) |
| `ProfileContacts` | Encrypted contact fields and per-field visibility |
| `ProfilePrivacy` | Privacy settings |
| `ProfileSubmissions` | Immutable review snapshots |
| `ProfileStatusHistory` | Every status transition |
| `ProfileRevisions` | Post-approval edit history |
| `ProfileFieldEdits` | One-time edit tracking |
| `PhotoModeration` | Moderation results and reasons |
| `VerificationEvents` | Step-by-step KYC history |
| `DocumentAccessLog` | Admin document views |
| `KycSessions` | Provider session linkage |
| `TaxonomyReligions`, `TaxonomyCommunities`, `TaxonomySubcastes`, `TaxonomyGotras`, `TaxonomyLanguages`, `TaxonomyDegrees`, `TaxonomyOccupations`, `TaxonomyIncomeRanges`, `TaxonomyLocations`, `TaxonomyInterests`, `TaxonomyPrompts`, `TaxonomyReasons` | Admin-managed reference data with stable codes and localized labels |
| `InterestEvents` | Interest transitions |
| `ShortlistCollections` | Named lists; default collection created per member |
| `MatchRecords` | Mutual matches |
| `ContactRevealLog` | Reveal audit |
| `Blocks` | Mutual block records |
| `Reports` | Safety reports |
| `ModerationActions` | Enforcement history |
| `ReportEvidence` | Snapshotted evidence |
| `ConversationParticipants` | Normalized participant access for future multi-party conversations |
| `MessageReceipts` | Per-recipient read state for future multi-party conversations |
| `NotificationPreferences` | Per event × channel |
| `PushSubscriptions` | Per device endpoints |
| `NotificationDeliveries` | Delivery status per channel |
| `Plans`, `PlanPrices`, `Memberships`, `Orders`, `Payments`, `Refunds`, `Invoices`, `Coupons` | Billing |
| `SavedSearches` | Saved filters |
| `HoroscopeCharts` | Stored chart results and engine version |
| `GunaMilanCache` | Pair score cache |
| `BiodataJobs` | PDF generation jobs |
| `BiodataTemplates` | Template registry |
| `SupportTickets`, `TicketMessages` | Support |
| `Broadcasts` | Admin announcements |
| `FeatureFlags` | Runtime flags |
| `ConsentRecords` | Versioned consents: `code`, `version`, `documentHash`, `textSnapshot`, `userName`, `ip`, `userAgent`, `grantedAt`, `expiresAt`, `revokedAt`, `source` |
| `DataRequests` | Export/deletion workflow |
| `OutboxEvents` | Reliable domain event publishing |

### 6.3 Column extensions to existing tables

| Table | Added/updated columns |
|---|---|
| `Users` | `language`, `alternateMobile`, `whatsappNumber`, `deletedAt`; keep `lastSeen` as the activity timestamp; extend `accountStatus` enum with `suspended`, `deleted`; extend `membershipType` with `free`, `prime`, `elite` |
| `Profiles` | `profileStatus`, `submittedAt`, `approvedAt`, `slaDueAt`, `primaryPhotoId`; keep `profileCompletePct` as the completion value |
| `ProfilePersonal` | `motherTongue`, `bodyType`, `aboutMyself`, `lookingFor`, `alternateEmail`, `specialCases` |
| `ProfileReligious` | `communityCode`, `subcasteCode`, `gotraCode`, `horoscopeMatchMust` (keep legacy text columns during migration) |
| `ProfileLocations` | `citizenship`, `interestedSettlingAbroad`, `familyBasedOutOf`, `livingWithParents` |
| `ProfileProfessional` | `employmentType`, `employer`, `incomeCurrency`, `annualIncomeRange`, `aboutCareer`, `workingAbroad` |
| `ProfileFamilyBio` | `familyType`, `familyValues`, `familyStatus`, `familyIncomeRange`, parent statuses/occupations, sibling counts, `aboutFamily` |
| `ProfileLifestyle` | `smokingHabits`, `drinkingHabits`, `openToPets`, `ownsHouse`, `ownsCar`, hobby/interest collections |
| `ProfileHoroscope` | birth place/time, accuracy, rashi, nakshatra, chart style, source, file reference |
| `Interests` | `message`, `expiresAt`, `withdrawnAt`; replace the all-status unique constraint with the partial pending index |
| `Shortlists` | `collectionId`, `updatedAt`; replace the `(userId, targetId)` unique constraint with `(collectionId, targetId)` |
| `HiddenProfiles` | `reason`, `updatedAt` |
| `Messages` | `type`, `mediaId`, `readAt`; `isRead` kept for compatibility |
| `Notifications` | `readAt`, `deepLink`, `eventCode`, `deliveryStatus`; `isRead` kept |
| `IdVerifications` | `livenessScore`, `nameMatchScore`, `verificationStatus`, `retentionDeleteAt`, `provider`, `providerSessionId` |

### 6.4 Key constraints and indexes

- Partial unique index: one active interest per `(senderId, receiverId)` where status = `pending`; the existing all-status unique constraint is replaced in a forward migration after backfilling history.
- Unique `(user1Id, user2Id)` on conversations with the pair ordered (`user1Id` < `user2Id`).
- Unique `(profileUid)`, `Users.email` (lowercased), `Users.mobile`.
- Unique `(collectionId, targetId)` on `Shortlists` after backfilling every existing row into the member's default collection; the old `(userId, targetId)` unique constraint is dropped in the same forward migration.
- Unique `(provider, providerOrderId)`, `(provider, providerPaymentId)`, `(provider, eventId)` for idempotency.
- Unique perceptual hash index for duplicate photo detection (with a distance threshold, not exact match).
- Indexes on search filters: age (via DOB range), height, marital status, religion, community, sub-caste, mother tongue, country/state/city, education level, occupation, income range, diet, smoking, drinking, manglik, last active.
- GIN/trigram index on name, about and prompts.
- Index on `profileStatus` + `createdAt` for the review queue.
- Index on `Notifications (userId, isRead, createdAt)`; a nullable `readAt` column may be added for per-device read state.
- Index on `Messages (conversationId, createdAt)`.
- Index on `AdminAuditLog (createdAt, action, targetId)`.
- Foreign keys with `ON DELETE` behaviour chosen per table (cascade for owned data, restrict for audit/financial).

### 6.5 Migration rules

- Raw SQL via `node-pg-migrate`; every migration is forward-only and idempotent where possible.
- No destructive change without a backfill and a two-release deprecation window.
- New columns are nullable or have defaults; backfill in a separate job.
- Enum changes use lookup tables or additive values, never renames.
- Every migration is tested against a production-like snapshot.
- Stored functions are versioned and called through services, not controllers.

### 6.6 Data classification

| Class | Examples | Handling |
|---|---|---|
| Public | Display name, age, city, community, education | Normal access control |
| Sensitive | Contact details, horoscope, income, sibling details | Entitlement + visibility rules |
| Highly sensitive | ID numbers, ID images, selfie, special cases, messages | Encryption, strict authorization, audit, retention |
| Financial | Orders, payments, invoices, refunds | Restricted access, 7-year retention |
| Audit | Admin actions, document views, consent | Append-only; 24 months by default, longer where law requires |

## 7. Integrations and adapters

| Capability | Adapter | Launch |
|---|---|---|
| KYC | `KycProvider`; launch implementation `ManualKycProvider` (admin compares member photo and ID proof). Managed provider (HyperVerge/Signzy/IDfy; Rekognition fallback) later | Yes (manual) |
| Payments | `PaymentProvider` (Razorpay) | Yes |
| SMS | `SmsProvider` (MSG91 or equivalent) | Yes |
| Email | `EmailProvider` (SES/Postmark) | Yes |
| Push (web) | `WebPushProvider` (VAPID) | Yes |
| Push (native) | FCM/APNs | Expo |
| Storage | `StorageProvider` (S3/R2) | Yes |
| Media moderation | `ModerationProvider` (cloud vision) | Yes |
| Video | `VideoProvider` (Agora) | P3 |
| PDF | `PdfRenderer` (headless Chromium/service) | P2 |
| Analytics | `AnalyticsProvider` | Yes |
| Error tracking | `ErrorTracker` | Yes |

Every adapter has a deterministic fake used by tests and a health check surfaced in admin.

## 8. Webhooks

| Provider | Events | Handling |
|---|---|---|
| Razorpay | `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, subscription events | Verify signature, store raw payload, idempotent by event ID, grant/revoke entitlements |
| KYC provider (when a managed provider is enabled) | session completed/failed | Verify signature/IP, update verification state, enqueue review |
| SMS/email | delivery/bounce | Update delivery status, suppress invalid addresses |
| Push service | subscription expired | Prune subscription |

Webhook endpoints are public but signature-verified, rate-limited, return `2xx` quickly and process asynchronously. Unverified requests are rejected and logged.

## 9. Contract governance

- OpenAPI 3.1 is generated from the NestJS controllers/DTOs and committed as an artifact.
- PWA and AdminPanel types are generated from the OpenAPI document; no hand-written duplicate types.
- CI fails if the generated document changes without a client regeneration.
- Breaking changes require a version bump and a deprecation notice in release notes.
- Example payloads are validated against schemas in tests.
- The contract includes auth schemes, error envelopes, enums and pagination.

## 10. Acceptance checklist

- [ ] Every endpoint has a documented request, response, errors and authorization scope.
- [ ] The error envelope is consistent and localized.
- [ ] Pagination, sorting and filtering follow the conventions.
- [ ] Idempotency is enforced where retries are possible.
- [ ] The existing routes keep working through the migration window.
- [ ] New tables have keys, constraints, indexes, timestamps and classification.
- [ ] Migrations are forward-only, tested and non-destructive.
- [ ] Every integration sits behind an adapter with a fake.
- [ ] Webhooks are signature-verified, idempotent and audited.
- [ ] OpenAPI and client types are generated and checked in CI.
- [ ] Authorization is tested from the API, not the UI.
