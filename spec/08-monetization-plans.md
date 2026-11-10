# 08 — Monetization and Plans

## 1. Model

Freemium. Registration, profile creation, browsing, search, recommendations, sending interests and shortlisting are free. Paid tiers unlock contact details, chat initiation, premium discovery and assisted services.

All plan names, prices, durations and entitlements are **database configuration**. No price or entitlement is hardcoded in the API, PWA or admin bundle.

### 1.1 Launch mode — free trial

All product features are free during the launch trial. The member journey has no paywall, no plan picker and no Razorpay checkout until billing is switched on. This is not a throwaway mode:

- Every gated capability calls the server-side `EntitlementService` (`can(member, key)`), never a plan name or a hardcoded boolean.
- `billingEnabled` and per-entitlement `freeInLaunchMode` are configuration. With `billingEnabled=false`, every entitlement resolves to allowed for an eligible member; enabling it later restores the plan matrix below without touching feature code.
- Plans, prices and entitlements are seeded and editable in the admin panel. Razorpay stays behind `PaymentProvider` with a fake for tests.
- The admin can flip one capability to paid (for example `contact.reveal`) by changing its configuration, without a release.

The matrix in §2.1 describes the target paid state; during the launch trial every row resolves to "Yes" through the entitlement service.

## 2. Plans

| Plan | Code | Billing | Positioning |
|---|---|---|---|
| Free | `free` | — | Complete profile, browse, search, interests, shortlists |
| Prime | `prime` | Monthly / quarterly / 6-month | Contact reveal, chat, who-viewed-me, advanced discovery |
| Elite / Assisted | `elite` | 3-month / 6-month | Prime + relationship manager, curated introductions, priority support |

Launch scope is Free and Prime. Elite is Phase 3 and uses the same entitlement engine.

### 2.1 Entitlement matrix

| Capability | Free | Prime | Elite |
|---|---|---|---|
| Create profile, verify, browse | Yes | Yes | Yes |
| Search and filters | Yes | Yes | Yes + saved searches |
| Daily recommendations | 9/day | 15/day | 25/day + curated list |
| Send interest | Yes | Yes | Yes |
| Personalised interest note | No | Yes | Yes |
| Receive and reply to chat | Yes, once unlocked | Yes | Yes |
| Start a new chat | No | Yes | Yes |
| Contact details reveal | Limited (grace rule) | Yes, rate-limited | Yes, higher limit |
| Who viewed me | No | 30-day history | 90-day history |
| Advanced filters (income, education, etc.) | Basic | Full | Full |
| Profile visibility boost | No | Yes (disclosed) | Yes (highest, disclosed) |
| Shortlist limit | 200 | 1,000 | 2,000 |
| Biodata PDF | Yes | Yes + templates | Yes + templates + RM branding |
| Horoscope / Guna Milan detail | Summary | Full | Full |
| Video calling (Phase 3) | No | Yes | Yes |
| Live events (Phase 3) | No | Yes | Yes |
| Relationship manager | No | No | Yes |
| Curated introductions | No | No | 3/month |
| Priority support | No | Email | Dedicated |

Entitlement keys are stable strings (`contact.reveal`, `chat.start`, `discovery.whoViewed`, `discovery.boost`, `biodata.templates`, `video.call`, `events.live`, `assisted.rm`). The server resolves keys per request; the client may cache them but never decides access.

## 3. Pricing configuration

### 3.1 Data model

`Plans`:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `code` | string | Stable key: `free`, `prime`, `elite` |
| `name` | JSONB | Localized `{ en, hi, gu }` |
| `description` | JSONB | Localized |
| `entitlements` | JSONB | Array of entitlement keys |
| `isActive` | boolean | |
| `sortOrder` | integer | Display order |

`PlanPrices`:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `planId` | UUID | |
| `currency` | string | `INR` at launch |
| `amountMinor` | integer | Paise; never float |
| `interval` | enum | `month`, `quarter`, `halfYear`, `year` |
| `durationDays` | integer | Derived from interval |
| `trialDays` | integer | 0 by default; the launch trial is controlled by `billingEnabled`, not by a per-plan trial |
| `taxIncluded` | boolean | Display rule |
| `taxRate` | numeric | GST rate configuration |
| `provider` | enum | `razorpay`, later `apple`, `google` |
| `providerPriceId` | string | Provider-side identifier |
| `isActive` | boolean | |
| `effectiveFrom` | timestamp | |

`EntitlementOverrides` supports support grants, promotions and refunds with expiry and reason.

### 3.2 Rules

- Amounts are integers in the minor unit; formatting is a client concern.
- Showing prices includes taxes and the billing period, e.g. "₹X for 3 months, taxes included".
- Price changes do not affect active subscriptions until renewal.
- A plan can be disabled without deleting history.
- Currency and tax rules are configuration; INR is the launch currency.
- Discounts are explicit price rows or coupon records, never client-supplied amounts.

## 4. Purchase flow (Razorpay, PWA)

1. Member taps an upgrade CTA or a locked action.
2. `GET /billing/plans` returns active plans, prices, entitlements and localized copy.
3. Member selects a plan and price.
4. `POST /billing/orders` with `{ planPriceId, idempotencyKey }`:
   - server validates the member, plan and price;
   - creates a Razorpay order server-side with the exact amount;
   - stores an `Orders` row (`created`, `providerOrderId`, amount, currency, planPriceId);
   - returns `{ orderId, providerOrderId, amount, currency, keyId, prefill }`.
5. Client opens Razorpay Checkout with the returned order.
6. On success, the client posts `{ razorpayPaymentId, razorpayOrderId, razorpaySignature }` to `POST /billing/verify`.
7. Server verifies the signature with the Razorpay secret, marks the payment `paid`, grants the entitlement and returns the new membership.
8. Razorpay webhooks (`payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, subscription events) are verified and processed idempotently. Webhooks are the source of truth; client verification is a fast path.
9. On failure, the client shows a retry path; the order remains `created` until it expires.

### 4.1 Idempotency and reconciliation

- Every order, payment and webhook has a unique provider ID with a unique index.
- Webhook handlers are idempotent by event ID; duplicate events are logged and ignored.
- A reconciliation job polls pending orders and provider payments every 10 minutes for 24 hours.
- If the client closes after paying, the webhook grants the plan and the member sees it on the next open.
- Signature verification failures are logged and alerted; the order is not fulfilled.

### 4.2 Security

- Razorpay key secret and webhook secret live in a secret manager, never in the repo.
- The client never sends an amount; the server derives it from the price row.
- The API checks that the order belongs to the authenticated member.
- Webhook endpoints verify the signature and source IP where supported.
- Raw webhook payloads are stored (redacted) for audit.
- Rate-limit order creation per member (e.g. 5 per hour).

### 4.3 Refunds

- Refund window: 7 days from purchase if no contact reveal or chat start has occurred (configurable).
- Refunds are issued by support with a reason and audited.
- Refund processing revokes the entitlement at the end of the current period or immediately, per policy; default immediate for a full refund.
- Partial refunds are possible for service failures and are recorded against the order.
- Provider refund webhooks update the order and entitlement.

### 4.4 Invoices and GST

- An invoice is generated for every successful payment with invoice number, date, member details, plan, amount, tax breakup and GSTIN if provided.
- Invoices are stored as PDFs and emailed; they are downloadable from Settings.
- GST rate and seller details are configuration.
- Financial records are retained per law (7+ years) even after account deletion.

## 5. Membership lifecycle

| State | Meaning |
|---|---|
| `none` | Free member |
| `active` | Paid plan in force |
| `grace` | Payment failed; access retained for a short window |
| `expired` | Plan ended |
| `cancelled` | Auto-renew off; access until period end |
| `refunded` | Purchase refunded; entitlement revoked per policy |

- `Membership` stores plan, source (`razorpay`, `adminGrant`, `promo`), start, end, autoRenew, provider IDs and status.
- Entitlements are resolved from active memberships plus overrides, with the highest tier winning.
- Expiry is evaluated server-side on every entitlement check and by a scheduled job for notifications.
- Auto-renew uses Razorpay subscriptions where available; otherwise a renewal reminder + re-purchase flow.
- A failed renewal enters `grace` for 3 days, then expires. The member is notified at failure, 1 day before expiry and on expiry.

### 5.1 Upgrade, downgrade, cancellation

- Upgrading (Prime → Elite) is immediate with proration handled by a new order for the difference or a fresh period, per configuration.
- Downgrading takes effect at period end; the current period is not refunded.
- Cancellation stops auto-renew and keeps access until the end date.
- Re-subscribing after expiry starts a new period; remaining time is never double-counted.

## 6. Paywalls and UX rules

- A locked action shows **what** is locked, **which plan** unlocks it and the **exact price**, then a CTA.
- Never hide the price behind a second screen.
- Free members see a preview of who-viewed-me counts, not identities.
- After purchase, the member returns to the original action, not the home screen.
- A successful purchase shows the plan, end date and invoice link.
- Renewal reminders are sent 3 days before charge and on failure.
- Cancellation is available in Settings in ≤ 2 taps and never requires support.
- No fake urgency, countdowns or pre-checked consent.
- Prices are shown in the member's language with locale number formatting.

## 7. Admin operations

| Capability | Permission |
|---|---|
| View plans, prices, entitlements | Analyst, Support, Reviewer, Super admin |
| Create/edit plans and prices | Super admin |
| Grant/revoke a plan | Support (with reason), Super admin |
| Issue refund | Support up to a limit, Super admin unlimited |
| View revenue dashboard | Analyst, Super admin |
| Export financial data | Super admin |
| Configure coupons/promotions | Super admin |

All commercial actions are audited with actor, target, amount, reason and timestamp.

### 7.1 Dashboards

- Revenue by day/month, plan mix, ARPU.
- Funnel: paywall shown → checkout started → paid.
- Conversion by entry point (contact reveal, chat, who-viewed).
- Refund rate, failure rate, renewal rate, churn.
- Outstanding reconciliation mismatches.

## 8. Future store billing (Expo phase)

- Add `apple` and `google` providers behind the same `PaymentProvider` interface.
- RevenueCat may manage cross-platform entitlements; the backend remains the source of truth via webhook sync.
- Store rules: digital subscriptions must use in-app purchase; external payment links are not allowed for in-app digital goods.
- Entitlements purchased on web must be restorable on native and vice versa, keyed by the member account.
- Price display on native uses store-provided localized prices.
- Refunds follow store policy; the backend reconciles via server notifications.

The entitlement service is provider-agnostic from day one so this is an adapter addition, not a product rewrite.

## 9. Provider abstraction

```ts
interface PaymentProvider {
  createOrder(input: { amountMinor: number; currency: string; receipt: string; notes?: Record<string, string> }): Promise<ProviderOrder>;
  verifyPayment(input: { orderId: string; paymentId: string; signature: string }): Promise<boolean>;
  parseWebhook(payload: unknown, signature: string): ProviderEvent;
  refund(input: { paymentId: string; amountMinor?: number; reason: string }): Promise<ProviderRefund>;
}
```

- `RazorpayProvider` at launch.
- `FakePaymentProvider` for tests, with deterministic success/failure/timeout modes.
- `AppleProvider` / `GoogleProvider` / `RevenueCatProvider` added later.

## 10. Failure modes

| Failure | Behaviour |
|---|---|
| Payment succeeds, verify call fails | Webhook still grants; client polls order status |
| Webhook delayed | Order shows pending; reconciliation job resolves |
| Duplicate webhook | Ignored by event ID |
| Amount mismatch | Order rejected and alerted; no fulfilment |
| Refund fails at provider | Retried; support notified; audit records attempt |
| Plan misconfigured | Server refuses to sell an inactive or invalid price |
| Entitlement cache stale | Server is authoritative; cache TTL ≤ 60 seconds |
| Member pays twice | Detect duplicate active periods, refund the extra, notify |

## 11. Acceptance checklist

- [ ] No price or entitlement is hardcoded in any client.
- [ ] Plan and price changes require no release.
- [ ] Orders are created server-side with server-derived amounts.
- [ ] Signature and webhook verification are enforced.
- [ ] Webhooks and client verification are idempotent.
- [ ] Entitlements are resolved server-side per request.
- [ ] Every locked action leads to a clear paywall with price and plan.
- [ ] Invoices, GST details and refunds are supported.
- [ ] Cancellation is self-service and takes effect at period end.
- [ ] Renewal reminders and grace period are implemented.
- [ ] Admin grants/revokes/refunds are audited.
- [ ] The payment provider is swappable without product logic changes.
- [ ] Web and future store purchases restore the same entitlements.
