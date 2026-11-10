# 09 — Admin and Operations

## 1. Scope

The AdminPanel is a React + Vite SPA that shares the NestJS API. It covers:

- profile and verification review;
- photo and content moderation;
- member and account management;
- reports, safety and enforcement;
- support tickets and refunds;
- taxonomy/reference data;
- plans and promotions;
- broadcasts, feature flags and maintenance;
- analytics and audit;
- DPDP data requests.

## 2. Roles and permissions

| Role | Purpose | Key permissions |
|---|---|---|
| `superAdmin` | Full control | Everything, including role management, exports, data deletion, settings |
| `reviewer` | Profile/ID review | View queue, view documents, approve, request changes, reject, override one-time fields |
| `moderator` | Content and safety | Photo queue, reports, hide content, warn, suspend/ban within policy |
| `support` | Member help | Search members, view profile context, resend OTP, reset verification, grant plans, refund within limit, tickets |
| `analyst` | Read-only analytics | Dashboards, revenue, funnels, aggregates; no PII documents |

### 2.1 Rules

- Least privilege by default; every permission is explicit.
- MFA is mandatory for every admin account.
- Session lifetime is shorter than member sessions (e.g. 8 hours) with idle timeout.
- Sensitive actions require re-authentication (step-up) where supported.
- Admin accounts are provisioned by super admins; no self-signup.
- Role changes are audited.
- Admin access is separate from member auth; an admin token cannot act as a member.

### 2.2 Authorization matrix (excerpt)

| Action | Super | Reviewer | Moderator | Support | Analyst |
|---|---|---|---|---|---|
| View review queue | Yes | Yes | No | No | No |
| View ID document | Yes | Yes | No | No | No |
| Approve/reject profile | Yes | Yes | No | No | No |
| Override one-time field | Yes | Yes | No | No | No |
| Photo moderation | Yes | Yes | Yes | No | No |
| Reports queue | Yes | No | Yes | View only | No |
| Suspend/ban account | Yes | No | Yes (limits) | No | No |
| Reset verification | Yes | Yes | No | Yes | No |
| Grant plan | Yes | No | No | Yes (limit) | No |
| Refund | Yes | No | No | Yes (limit) | No |
| Edit taxonomy | Yes | No | No | No | No |
| Feature flags | Yes | No | No | No | No |
| Export audit | Yes | No | No | No | No |
| Delete member data | Yes | No | No | No | No |

The full matrix lives in code as a permission map and is tested as an authorization matrix.

## 3. Admin authentication

- Email + password + TOTP MFA (authenticator app), with recovery codes.
- Optional IP allowlist for super admins.
- Login rate limiting and lockout.
- Every login, failed attempt and MFA change is audited.
- Separate refresh cookie scoped to the admin host.
- Admin sessions are listed and revocable.

## 4. Dashboard

Default landing shows actionable counts and trends:

- pending profile reviews (with SLA age)
- photo moderation queue
- open reports by priority
- verification manual-review queue
- support tickets by status
- signups today / 7 days
- approvals and rejections today
- revenue today / month, conversion
- payment failures and reconciliation mismatches
- deletion/export requests due
- system health (API, queue depth, worker failures)

Each tile links to the filtered queue. The dashboard refreshes without a full page reload.

## 5. Review queue and workspace

Detailed workflow is in `04-media-verification-approval.md` §4. Additional admin requirements:

- Keyboard shortcuts for decision actions and next/previous.
- Queue assignment and claim to avoid duplicate work.
- Filters persisted per admin.
- Bulk assign/tag only; no bulk approve.
- Inline diff against the previous submission when resubmitting.
- Reviewer notes are internal and never shown to members.
- A decision cannot be submitted without a reason code.
- The workspace shows the member's language so support can respond appropriately.

## 6. Member management

### 6.1 Search

- By profile ID, name, email, mobile, user ID.
- Results show status, verification, plan, created date, last active.
- PII visibility is permission-gated; search results mask contact by default.

### 6.2 Member profile view

Tabs: overview, profile sections, photos, verification, membership and payments, interests/chat summary, reports, audit history, support tickets.

- Read-only by default; edit actions are explicit and audited.
- Document views are logged.
- No impersonation or "log in as member".
- A support note field records context for the next agent.

### 6.3 Account actions

| Action | Effect | Permission |
|---|---|---|
| Resend OTP | Sends a new code | Support |
| Force email/mobile verification | Marks verified after evidence | Support + reason |
| Reset verification | Returns to `notStarted` | Support/Reviewer + reason |
| Suspend | Hides profile, blocks login, reversible | Moderator/Super |
| Ban | Blocks account, revokes sessions, blocks re-registration by hashes | Super |
| Restore | Reverses suspension | Super |
| Grant plan | Adds membership with expiry | Support (limit) |
| Revoke plan | Ends membership | Super |
| Refund | Provider refund | Support (limit)/Super |
| Delete data | Starts DPDP deletion | Super |

Every action requires a reason and writes an audit record.

## 7. Moderation

### 7.1 Photo queue

- New uploads flagged by auto-moderation appear with a thumbnail, score, reasons and member context.
- Decisions: approve, reject (reason), escalate.
- Rejections notify the member with guidance.
- Repeated violations escalate the account.
- SLA: same day for flagged content.

### 7.2 Reports queue

- Sorted by priority (critical, high, medium) then age.
- Evidence panel: reported profile, message snapshots, photos, prior reports, account history.
- Actions: dismiss, warn, hide content, restrict messaging, suspend, ban, escalate.
- Outcome notification to reporter and, where appropriate, the reported member.
- Critical reports (underage, threats) page the on-call moderator.

### 7.3 Policy reasons

A controlled vocabulary for decisions: fake profile, impersonation, harassment, hate speech, nudity, violence, spam, scam, underage, contact spam, terms violation, other. Each has a member-facing explanation template in all languages.

## 8. Support

### 8.1 Tickets

- Channels: in-app help form, email, and admin-created.
- Fields: member, category, subject, description, attachments, priority, status, assignee, SLA.
- Categories: login, OTP, verification, profile edit, payment, refund, safety, data request, other.
- Canned responses in en/hi/gu with placeholders.
- Internal notes separate from member-visible replies.
- Statuses: open, pending member, pending internal, resolved, closed.
- SLA: first response < 12 hours; resolution < 48 hours.

### 8.2 Common workflows

| Request | Resolution path |
|---|---|
| Cannot receive OTP | Check provider status, resend, alternative email OTP, verify identity, support override |
| Verification stuck | Inspect provider result, retry, manual approve/reject with reason |
| Wrong one-time field | Verify evidence, override with reason |
| Payment succeeded but no plan | Check order/webhook, reconcile, grant manually if verified |
| Refund request | Check eligibility window and usage, issue refund, revoke entitlement |
| Report | Route to moderation, not support |
| Data export/deletion | Route to the DPDP workflow with identity verification |

## 9. Taxonomy and reference data

Editable entities: religions, communities, sub-castes, gotras, languages, education levels, degrees, occupations, income ranges, countries/states/cities, interests, prompts, diet/smoking/drinking options, rejection reasons.

Rules:

- Every entry has a stable `code`, localized labels, active flag and sort order.
- Codes are never reused or renamed; labels can change.
- Deactivating an entry hides it from new selections but keeps existing data valid.
- Changes are validated and audited.
- Caches are invalidated on change.
- Bulk import is supported with a dry-run diff.

## 10. Plans, promotions and payments

- View and edit plans, prices, entitlements and tax configuration.
- Create coupons with code, discount, validity, usage limit and plan scope.
- View orders, payments, refunds and reconciliation mismatches.
- Manual grant/revoke/refund with reason and audit.
- Export financial reports (CSV) with permission and audit.

## 11. Communications

- Targeted broadcast by segment (status, plan, location, language, last active).
- Channels: in-app, push, email, SMS; each requires an explicit selection.
- Preview, test send, schedule and cancel.
- Frequency caps and quiet hours respected; transactional messages are exempt.
- Broadcast history with delivery stats.
- Templates are localized and versioned.

## 12. Feature flags and operations

- Flags: boolean, percentage rollout, allowlist, platform (web/expo), environment.
- Flags for chat, video, payments, horoscope matching, new search, biodata templates.
- Changes are audited and take effect without a deploy.
- Maintenance mode: read-only or full block, with a member-facing message and estimated time.
- Minimum supported version: the PWA checks on load and prompts a refresh; critical versions force a reload.
- Kill switches for third-party providers (KYC when a managed provider is enabled, payments, SMS, push) with graceful degradation.

## 13. Audit

- Append-only `AdminAuditLog` for all sensitive actions (see `04` §4.5).
- Searchable by actor, action, target, date and request ID.
- Exportable CSV/JSON by super admin.
- Tamper-evident: records are insert-only; no update/delete via the API.
- Retention: 24 months by default, or longer where a legal/financial obligation requires it.
- Document-access logs are separate and include duration.
- Regular access reviews of admin roles and permissions.

## 14. Analytics

### 14.1 Product metrics

- Funnel: visit → register → OTP → profile start → submit → approve → first interest → match → chat → paid.
- Cohort retention (D1/D7/D30/D90).
- Activation by acquisition source, language and device.
- Search success rate (results viewed, interests sent per search).
- Recommendation CTR and interest conversion.
- Match and conversation rates.
- Report and block rates.
- Paywall views, checkout starts, purchases, refunds.

### 14.2 Operational metrics

- Queue depth and age; reviewer throughput; SLA compliance.
- Auto-verification pass rate; manual-review rate; false-reject appeals.
- Notification delivery and failure rates.
- API latency/error rate; worker failures; DB and Redis health.
- Storage usage and retention-job success.

### 14.3 Privacy

- Analytics use pseudonymous IDs and aggregate where possible.
- No message content, ID numbers, contact details or raw photos in analytics.
- Dashboards respect role permissions.
- Exports are audited.

## 15. DPDP data requests

- Members can request export or deletion in Settings.
- Requests create a tracked task with identity verification (OTP + password, or support call).
- Export: machine-readable archive of profile, photos, interests, shortlists, messages (if retained), consents and payments; delivered via a signed link with expiry.
- Deletion: immediate deactivation and removal from discovery; PII deleted or anonymised after the cooling-off period (default 30 days); financial/audit records retained as required by law.
- SLA: acknowledge within 48 hours, complete within 30 days.
- The admin queue shows due dates and status.
- Every request and action is audited.

## 16. AdminPanel UX standards

- Desktop-first, responsive down to tablet.
- Dense data tables with sticky headers, column selection and saved filters.
- Clear empty, loading, error and permission-denied states.
- Destructive actions require confirmation with a reason.
- No action succeeds silently; a toast and audit entry confirm it.
- Accessibility: keyboard navigable, labelled controls, focus management in dialogs.
- Dark mode optional; high-contrast text is mandatory.

## 17. Acceptance checklist

- [ ] Every admin role has a tested permission matrix; no endpoint relies on hidden UI.
- [ ] MFA is mandatory and enforced server-side.
- [ ] Review queue is oldest-first with SLA indicators.
- [ ] Decisions require a reason and write an audit entry.
- [ ] Document views are logged.
- [ ] Member actions (suspend, ban, restore, grant, refund, delete) are audited.
- [ ] Photo and report queues show evidence and policy reasons.
- [ ] Support tickets have SLAs, canned responses and member context.
- [ ] Taxonomy edits are validated, audited and cache-invalidating.
- [ ] Plans and prices are editable without a release.
- [ ] Feature flags and maintenance mode work without a deploy.
- [ ] Broadcasts respect preferences and caps.
- [ ] Audit logs are append-only and exportable.
- [ ] DPDP export/deletion requests are tracked to completion.
- [ ] Admin analytics contain no PII or message content.
