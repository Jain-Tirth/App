# 06 — Engagement, Messaging and Safety

## 1. Scope

This appendix covers everything that happens after a member finds a candidate:

- interests (send, accept, decline, withdraw, expire);
- shortlists (named collections);
- ignore/hide and undo;
- notifications (in-app, web push, SMS, email);
- chat (eligibility, real-time delivery, media, read receipts, moderation);
- contact reveal;
- safety (block, report, enforcement);
- video calling (Phase 3).

## 2. Interests

### 2.1 Model

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `senderId` | UUID | Member sending |
| `receiverId` | UUID | Member receiving |
| `status` | enum | `pending`, `accepted`, `declined`, `withdrawn`, `expired` |
| `message` | text | Optional Prime-only note, ≤ 300 chars, profanity-scanned |
| `createdAt` | timestamp | Sent time |
| `respondedAt` | timestamp | Accept/decline time |
| `expiresAt` | timestamp | Default 30 days |
| `respondedByDevice` | string | Optional audit context |

### 2.2 Rules

- One active interest per sender→receiver pair. Re-sending after decline is blocked for 90 days.
- Sending an interest is free for all approved members.
- A personalised note requires Prime; without Prime the note field is hidden, not silently dropped.
- The receiver sees the sender's profile summary, compatibility reasons and note (if any).
- Accepting creates a mutual match record if the receiver had also sent an interest, otherwise acceptance alone is a one-way acceptance that unlocks contact reveal subject to entitlement.
- Declining is private; the sender sees "Not accepted" only after 7 days or immediately, per configuration. Default: immediate neutral status, no reason shown.
- Sender can withdraw a pending interest.
- Expired interests move to `expired`; the sender may send a new one after 7 days if not declined.
- Interests are excluded from discovery of already-actioned profiles for 30 days.

### 2.3 States

```
pending → accepted | declined | withdrawn | expired
accepted → (terminal)
declined → (terminal, cooldown 90 days)
```

Every transition writes a row to `InterestEvents` for audit and analytics.

### 2.4 Acceptance criteria

- Duplicate active interests are impossible at the database level (partial unique index).
- Accept/decline is idempotent.
- A blocked member cannot send or receive an interest.
- Interest events generate exactly one notification per channel per event.
- Sender and receiver lists show correct status and pagination.

## 3. Shortlists

- A member can create multiple named shortlists (e.g. "Shortlisted", "Family approved", "Follow up").
- A profile can belong to several shortlists; adding twice to the same list is a no-op.
- Default shortlist is created on first use and cannot be deleted.
- Shortlists are private; the shortlisted member is not notified by default. A Prime "let them know" action is a Phase 3 option.
- Deleting a shortlist removes memberships but not the profiles.
- Shortlist limits: 200 profiles total for free, 1,000 for Prime (configuration).

## 4. Ignore / hide

- Ignoring a profile hides it from the ignorer's search, recommendations, interests and chat suggestions.
- Ignore is one-directional from the member's perspective; the ignored member is not told.
- A 5-second undo snackbar reverses the action; after that the entry is permanent until removed in Settings.
- Ignoring does not block; blocking is mutual exclusion and is managed separately.
- Hidden profiles are stored in `HiddenProfiles` with a reason (`ignored`, `notInterested`, `reported`).

## 5. Contact reveal

- Contact fields are masked until the viewer is entitled.
- Entitlement: accepted interest **and** (Prime or a configured grace rule); or an explicit per-field visibility of `everyone` from the owner **and** viewer entitlement.
- Reveal is a POST that returns the unmasked values for the fields the owner allows; it writes a `ContactRevealLog` row (viewer, owner, fields, timestamp, IP, request ID).
- The owner can see who revealed their contact in the who-viewed-me / contact-activity screen.
- Reveals are rate-limited (e.g. 50 per day for Prime, 10 for free grace).
- Revoking visibility does not retroactively hide values already seen, but blocks future reveals.

## 6. Notifications

### 6.1 Channels

| Channel | Implementation | Notes |
|---|---|---|
| In-app | `Notifications` table + unread count + notification centre | Always on |
| Web push | VAPID + service worker `push` handler | Installed PWA required on iOS |
| SMS | MSG91 or equivalent adapter | Critical events only |
| Email | SES/Postmark adapter + templates | Critical events, invoices, digests |
| Native push | FCM/APNs | Expo phase |

### 6.2 Event catalogue

| Code | Event | In-app | Push | SMS | Email |
|---|---|---|---|---|---|
| `account.otp` | OTP sent | — | — | Yes | If email OTP |
| `account.welcome` | Registration complete | Yes | No | No | Yes |
| `profile.submitted` | Profile submitted | Yes | Yes | Yes | Yes |
| `profile.approved` | Profile approved | Yes | Yes | Yes | Yes |
| `profile.needs_changes` | Changes requested | Yes | Yes | Yes | Yes |
| `profile.rejected` | Profile rejected | Yes | Yes | Yes | Yes |
| `verification.failed` | Verification failed | Yes | Yes | No | Yes |
| `interest.received` | New interest | Yes | Yes | No | Yes |
| `interest.accepted` | Interest accepted | Yes | Yes | Yes | Yes |
| `interest.declined` | Interest declined | Yes | Yes | No | No |
| `interest.expiring` | Interest expiring in 3 days | Yes | Yes | No | Yes |
| `match.mutual` | Mutual match | Yes | Yes | Yes | Yes |
| `message.new` | New message | Yes | Yes | No | Optional digest |
| `contact.revealed` | Someone revealed your contact | Yes | Yes | No | No |
| `profile.viewed` | Profile viewed (Prime) | Yes | No | No | Daily digest |
| `shortlist.updated` | Shortlist reminder (Prime) | Yes | No | No | Weekly digest |
| `membership.expiring` | Plan expiring in 3 days | Yes | Yes | Yes | Yes |
| `membership.renewed` | Renewal succeeded | Yes | No | Yes | Yes (invoice) |
| `payment.failed` | Payment failed | Yes | Yes | Yes | Yes |
| `report.outcome` | Report outcome | Yes | Yes | No | Yes |
| `security.new_device` | New device login | Yes | No | Yes | Yes |
| `account.deletion_scheduled` | Deletion cooling-off started | Yes | Yes | Yes | Yes |
| `system.broadcast` | Admin announcement | Yes | Optional | Optional | Optional |

### 6.3 Preferences

- Members can set per-event, per-channel preferences, except security and transactional events (OTP, payment, deletion) which are mandatory.
- Quiet hours (default 22:00–08:00 local) suppress push but not in-app; critical events bypass quiet hours.
- Digest frequency: instant, daily, weekly, off (for non-critical events).
- Preferences are stored as a JSONB object on `Users` or a `NotificationPreferences` table with event defaults.

### 6.4 Delivery pipeline

1. Domain service emits an event with a stable code, recipient, data payload and idempotency key.
2. Notification service resolves preferences and templates in the member's language.
3. In-app row is written immediately.
4. Push/SMS/email jobs are queued in BullMQ with retries and dead-letter handling.
5. Provider callbacks update delivery status (`queued`, `sent`, `delivered`, `failed`, `bounced`).
6. Failures are retried with exponential backoff (max 5 attempts); permanent failures are logged and surfaced in the admin delivery dashboard.

### 6.5 Payload rules

- Never include full contact details, ID numbers or document images in a notification.
- Push payloads contain `title`, `body`, `icon`, `tag` (for collapsing), `url` (deep link) and `notificationId`.
- Deep links use `/app/...` routes with a fallback to the notification centre when the target is not accessible.
- All templates are localized (en/hi/gu) with ICU message format for counts and dates.

### 6.6 Acceptance criteria

- Each event produces exactly one in-app notification (idempotent).
- Preferences are honoured, except mandatory events.
- Push subscriptions are stored per endpoint and removed on `pushsubscriptionchange` or logout.
- SMS falls back when push is unavailable for critical events.
- Notification tap opens the correct screen after auth and entitlement checks.
- Failed deliveries are retried and visible to admins.

## 7. Chat

### 7.1 Eligibility

Chat unlocks when **all** of the following are true:

1. Both profiles are approved and not blocked/suspended.
2. There is a mutual match (both interests accepted, or one accepted and the other sent). Default gating: mutual match + Prime on at least one side; the other side can reply without Prime. **This rule is TBD:** keep it configuration-driven (`chat.requireMutualMatch`, `chat.requirePrime`) so mutual-match-only or mutual-match-plus-Prime can be selected without a code change.
3. The conversation has not been frozen by moderation.

Free members can receive and reply to messages in an unlocked conversation; only Prime members can start a new conversation. This preserves the paywall without trapping non-paying recipients.

### 7.2 Conversation model

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `user1Id` / `user2Id` | UUID | Ordered pair, unique (`user1Id` < `user2Id`) |
| `status` | enum | `active`, `muted`, `frozen`, `closed` |
| `lastMessageAt` | timestamp | For sorting |
| `lastMessage` | text | Server-generated preview, profanity-scrubbed |
| `createdAt` / `updatedAt` | timestamp | |

`Messages`:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Client-generated idempotency key allowed |
| `conversationId` | UUID | |
| `senderId` | UUID | |
| `type` | enum | `text`, `image`, `system` |
| `content` | text | Encrypted at rest; ≤ 2,000 chars |
| `mediaId` | UUID | Phase 2 images |
| `isRead` | boolean | Existing column; kept for compatibility |
| `readAt` | timestamp | |
| `createdAt` | timestamp | |
| `deletedAt` | timestamp | Soft delete for the sender |

### 7.3 Real-time behaviour

- Socket.io with the Redis adapter; each member joins a room per user ID.
- Client emits `message:send` with a client message ID; server persists first, then acknowledges and broadcasts `message:new`.
- `message:read` marks messages read and broadcasts read receipts.
- `typing:start` / `typing:stop` are ephemeral and rate-limited (one per 3 seconds).
- Presence (`online`, `lastSeen`) is stored in Redis with a TTL and respects privacy settings.
- Reconnect uses the last message cursor to fetch missed messages; no message is lost.
- REST endpoints exist for history and for clients without sockets; sockets are an optimisation, not a requirement.

### 7.4 Safety controls

- Profanity and abuse scanning on send; blocked content returns a policy error and is not stored (except hashed evidence for reports).
- Rate limits: 30 messages/minute per sender, 200/hour, 60 new conversations/day for Prime.
- Links and phone numbers: contact-info detection warns the sender and masks the message until confirmed ("Share your number?"). Sharing is allowed with explicit confirmation.
- Media (Phase 2): images only, max 5 MB, moderated before delivery; no video/audio at launch.
- A report freezes the conversation immediately, preserves evidence, and notifies moderation.
- Blocking ends the conversation and prevents new messages in both directions.
- Messages are retained per policy; deleted messages show "Message deleted" for the other side.

### 7.5 Acceptance criteria

- The server enforces eligibility on every send; a client cannot bypass the paywall.
- Messages are persisted before acknowledgement.
- Reconnect delivers every message exactly once.
- Read receipts and typing are ephemeral and do not leak to non-participants.
- A blocked or frozen conversation rejects sends with a clear error.
- Rate limits and abuse scans are server-side.
- No chat content appears in push payloads beyond a generic preview.

## 8. Video calling (Phase 3)

- Agora Web SDK inside the PWA; native SDK after Expo.
- Available only for mutual matches with at least one Prime/Elite participant.
- Both parties see a consent prompt; no auto-answer.
- Calls are not recorded; call metadata (duration, participants, start/end) is logged for safety.
- In-call controls: mute, camera off, end, report.
- Network fallback to audio-only; clear error if permissions are denied.
- The call room token is short-lived and scoped to the conversation.
- Reports during a call create a high-priority moderation ticket with the call metadata.

## 9. Live events (Phase 3)

- Scheduled virtual meetups with a host and up to 20 participants.
- Registration is opt-in; profiles are shown in a moderated gallery.
- Video via Agora; chat via Socket.io; recording is prohibited.
- Hosts can mute, remove and report participants.
- Admin creates events, sets capacity and reviews post-event reports.

## 10. Safety and enforcement

### 10.1 Block

- Mutual: neither can see the other in discovery, view profiles, send interests or messages.
- Blocking is immediate; existing conversations are closed.
- The blocked member is not notified.
- A member can unblock from Settings; the block history remains for audit.

### 10.2 Report

| Reason code | Priority | Auto-action |
|---|---|---|
| `fakeProfile` | High | Hide pending review |
| `harassment` | High | Freeze conversation, hide from reporter |
| `inappropriatePhoto` | High | Hide photo, queue moderation |
| `spam` | Medium | Rate-limit, queue |
| `underage` | Critical | Immediate hide, escalate, preserve evidence |
| `scam` | High | Hide, fraud queue |
| `other` | Medium | Queue |

- Reports include reporter, target, reason, free-text details, message IDs or media IDs, and optional screenshots.
- The reporter receives an acknowledgement and a final outcome notification.
- Repeated reports (≥ 3 upheld in 90 days) trigger automatic suspension pending review.
- Retaliatory reporting is monitored; false reports are audited.

### 10.3 Enforcement ladder

1. Warning (in-app, recorded).
2. Content removal (photo/message).
3. Temporary restriction (e.g. 7-day messaging ban).
4. Suspension (profile hidden, login blocked).
5. Ban (account blocked, sessions revoked, re-registration blocked by mobile/ID hash).

Every action records the reason, evidence, admin, duration and appeal path.

### 10.4 Evidence and retention

- Reported messages/photos are snapshotted to an evidence store and retained for the investigation window (default 12 months) even if the member deletes them.
- Access is restricted to moderators and super admins and is audited.
- Evidence is deleted after the retention window unless legal hold applies.

## 11. Analytics events

Tracked (no PII in payloads):

- `interest_sent`, `interest_accepted`, `interest_declined`, `interest_expired`
- `shortlist_added`, `shortlist_removed`
- `profile_viewed`
- `conversation_started`, `message_sent`, `message_read`
- `contact_revealed`
- `report_created`, `block_created`
- `paywall_shown`, `checkout_started`, `purchase_completed`

Events include user pseudonymous ID, plan, platform, locale and experiment flags. They never include names, phone numbers, emails or message content.

## 12. Acceptance checklist

- [ ] Interest duplicate prevention, cooldown and expiry enforced server-side.
- [ ] Accept/decline is idempotent and audited.
- [ ] Shortlists support multiple named lists with limits.
- [ ] Ignore has undo and is enforced across discovery.
- [ ] Contact reveal is entitlement-gated and audited.
- [ ] Every notification event has a localized template in en/hi/gu.
- [ ] Preferences are honoured; mandatory events always deliver.
- [ ] Push subscriptions are per device and pruned.
- [ ] Chat eligibility is server-enforced; messages persist before ack.
- [ ] Reconnect delivers missed messages exactly once.
- [ ] Abuse scanning, rate limits and contact-info detection are active.
- [ ] Reports freeze conversations, preserve evidence and notify both parties appropriately.
- [ ] Block is mutual and immediate.
- [ ] Enforcement actions are audited and have an appeal path.
- [ ] Video (Phase 3) requires consent, is not recorded and is token-scoped.
