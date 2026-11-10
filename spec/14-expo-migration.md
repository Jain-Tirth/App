# 14 — Expo Migration Plan

## 1. Purpose

The PWA is the launch platform. Once it is feature-complete and the product has validated onboarding, verification, discovery, chat and payments, the member app moves to **Expo (React Native + TypeScript)** for native distribution, stronger device capabilities and store billing.

This is a **UI and platform migration**, not a product rewrite. The backend, admin panel, database and business rules stay. The PWA remains available during and after the migration.

## 2. Goals

- Reuse the product logic, API client, schemas, validators, formatters and i18n from `packages/core`.
- Replace only the UI layer and platform capabilities.
- Add native push, camera/liveness, secure storage, share, deep links, biometrics and store billing.
- Preserve entitlements across web and native.
- Keep one backend and one source of truth.

## 3. Non-goals

- Rewriting the backend or duplicating business rules in the app.
- Rebuilding the admin panel in React Native.
- Migrating the marketing site; it stays web.
- Replacing the PWA; it remains supported for users who do not install the native app.
- Adding new product features during the migration unless required for parity.

## 4. Target architecture

```
apps/
  user-web/        PWA (existing UserWeb)
  admin-web/       AdminPanel (existing)
  mobile/          Expo app (new)
packages/
  core/            API client, schemas, types, validators, formatters, i18n, domain rules
  platform/        Platform adapter interfaces (no implementations)
  ui-web/          Web-only components
  ui-native/       Native-only components (later)
  config/          Shared TS, ESLint, Tailwind/native theme tokens
```

### 4.1 `packages/core` responsibilities

- Typed API client generated from OpenAPI.
- Zod schemas and inferred types.
- Domain rules that are safe on the client (completion hints, validation, formatting); authoritative rules still run on the server.
- i18n resources and ICU formatting.
- Date, number, currency and phone formatters.
- Analytics event names and payload shapes.
- Feature flag keys and entitlement keys.
- **No** browser APIs, no React DOM, no `window`, no `localStorage`, no `fetch` assumptions beyond a configurable transport.

### 4.2 Platform adapter interfaces

```ts
interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

interface SecureStorageAdapter extends StorageAdapter {}

interface PushAdapter {
  requestPermission(): Promise<'granted' | 'denied' | 'default'>;
  getToken(): Promise<string | null>;
  onTokenRefresh(cb: (token: string) => void): () => void;
}

interface CameraAdapter {
  capturePhoto(options: { facing: 'front' | 'back'; quality: number }): Promise<{ uri: string; width: number; height: number }>;
}

interface ShareAdapter {
  share(input: { title?: string; message?: string; url?: string; fileUri?: string }): Promise<void>;
}

interface DeepLinkAdapter {
  getInitialUrl(): Promise<string | null>;
  onUrl(cb: (url: string) => void): () => void;
}

interface BiometricsAdapter {
  isAvailable(): Promise<boolean>;
  authenticate(reason: string): Promise<boolean>;
}

interface NetworkAdapter {
  isOnline(): boolean;
  subscribe(cb: (online: boolean) => void): () => void;
}

interface AppUpdateAdapter {
  getVersion(): string;
  promptUpdate(required: boolean): Promise<void>;
}
```

- PWA implementations live in `apps/user-web/src/platform`.
- Expo implementations live in `apps/mobile/src/platform`.
- `packages/core` depends only on the interfaces.

## 5. Migration strategy

### 5.1 Preconditions

- The entire PWA (Phases 1–3) is complete: every story implemented, tested, reviewed and every acceptance criterion passing.
- OpenAPI contract stable and versioned.
- `packages/core` already extracted and consumed by the PWA.
- Platform adapters already used by the PWA (so the seams exist).
- Analytics and error tracking keyed by a shared pseudonymous ID.

### 5.2 Approach

1. **Extract, don't fork.** Move any remaining shared logic from `UserWeb` into `packages/core` before starting.
2. **Build the native shell.** Expo Router, theme, navigation, auth, storage, API client and one read-only screen (home recommendations).
3. **Port journeys in vertical slices**, not screens: auth, onboarding section, discovery, profile detail, interest, shortlist, chat, payments, settings.
4. **Run both apps against the same staging backend** and compare behaviour with contract tests.
5. **Gate rollout** by feature flag and cohort; keep the PWA as fallback.
6. **Add native-only capabilities** after parity: native push, camera/liveness, store billing, biometrics, widgets (optional).

### 5.3 What is ported vs reused

| Layer | Action |
|---|---|
| API endpoints | Reuse unchanged |
| Business rules | Reuse from `packages/core`; server remains authoritative |
| Validation schemas | Reuse |
| i18n resources | Reuse |
| Formatters | Reuse |
| Design tokens | Share colour/spacing/type scales as data; map to Tailwind and React Native styles |
| Screens and navigation | Rebuild in React Native |
| Web-only components | Replace with native equivalents |
| Platform capabilities | New native adapters |
| Payments | Add store billing; keep Razorpay for web |
| Admin | Unchanged |

## 6. Screen map

| PWA route | Expo screen | Notes |
|---|---|---|
| `/` landing | `app/(public)/index` | Marketing may deep-link to the app |
| `/language` | `app/(auth)/language` | Same resources |
| `/register` | `app/(auth)/register` | Native keyboard/autofill |
| `/otp` | `app/(auth)/otp` | SMS autofill where available |
| `/onboarding/*` | `app/(app)/onboarding/*` | Section stack with progress |
| `/home` | `app/(app)/(tabs)/home` | Recommendations |
| `/search` | `app/(app)/(tabs)/search` | Filters as native sheets |
| `/profile/:uid` | `app/(app)/profile/[uid]` | Gallery, actions |
| `/interests` | `app/(app)/(tabs)/interests` | Sent/received tabs |
| `/shortlists` | `app/(app)/shortlists` | Named lists |
| `/chat` | `app/(app)/(tabs)/chat` | Conversation list |
| `/chat/:id` | `app/(app)/chat/[id]` | Real-time, keyboard handling |
| `/notifications` | `app/(app)/notifications` | Deep-link targets |
| `/plans` | `app/(app)/plans` | Store-localized prices |
| `/settings` | `app/(app)/(tabs)/settings` | Privacy, language, account |
| `/biodata` | `app/(app)/biodata` | Preview and native share |

Navigation uses Expo Router with typed routes. Deep links map to the same logical routes as the PWA so notification payloads and shared links work across platforms.

## 7. Platform capability mapping

| Capability | PWA | Expo |
|---|---|---|
| Token storage | In-memory access token + `HttpOnly` refresh cookie | Access token in memory; refresh token in SecureStore/Keychain |
| Session refresh | Cookie + CSRF header | Bearer refresh token with rotation |
| Push | Web Push + VAPID | FCM (Android) / APNs (iOS) via Expo Notifications |
| Camera | `getUserMedia` / file input | `expo-camera` / `expo-image-picker` |
| Liveness | Hosted KYC web flow / selfie challenge | Native KYC SDK or hosted flow in a secure browser |
| Share | Web Share API | `expo-sharing` / native share sheet |
| Deep links | URL routes | Universal links / app links |
| Biometrics | WebAuthn optional | `expo-local-authentication` |
| Offline drafts | IndexedDB | AsyncStorage / SQLite with the same draft schema |
| Updates | Service worker prompt | Expo Updates / store release |
| Payments | Razorpay web checkout | Apple/Google in-app purchase via RevenueCat |
| File download | Browser download | `expo-file-system` + share/open |
| Haptics | Not available | `expo-haptics` (optional) |

## 8. Authentication changes

- The PWA uses an `HttpOnly` refresh cookie. Native apps cannot rely on cookies the same way, so the Expo app uses:
  - access token in memory;
  - refresh token in `expo-secure-store` (Keychain/Keystore);
  - the same rotation, reuse detection and logout-all semantics.
- The backend accepts both refresh mechanisms on the same endpoint, distinguished by client type, with separate audiences.
- Device registration stores a device ID and push token for session management.
- Logout clears secure storage, cached data and push registration.

## 9. Offline and sync

- The PWA caches the app shell and drafts in IndexedDB.
- The Expo app caches API reads with a query cache (e.g. TanStack Query persisted to AsyncStorage/SQLite) and drafts in SQLite.
- Draft schema is shared in `packages/core` so a draft started on web can be recognised on native (same account, server-synced drafts).
- Conflicts resolve server-wins with a refresh prompt, exactly as in the PWA.
- No offline access to other members' private data.

## 10. Payments and store billing

- Web purchases continue through Razorpay.
- Native digital subscriptions use Apple/Google in-app purchase, managed through RevenueCat or direct server notifications.
- The backend entitlement service is provider-agnostic; store purchases create the same `Membership` records with `source = apple|google|revenuecat`.
- Entitlements restore by account, not by device.
- Price display on native uses store-localized prices; web shows INR configuration.
- Refund and cancellation follow store rules, with backend reconciliation.
- The app never links to external checkout for digital goods where store policy prohibits it.

## 11. Push and notifications

- Native push tokens are registered per device and user.
- The notification service chooses the channel by platform: Web Push for PWA, FCM/APNs for native.
- Critical events still fall back to SMS/email.
- Deep links open the right native screen; if the member is unauthenticated, login completes and then routes.
- Notification preferences are shared across platforms.
- Token refresh and logout remove stale tokens.

## 12. Design and UX

- Share colour, spacing, type scale and radius tokens as data in `packages/config`.
- Rebuild components natively; do not attempt to render web components in a WebView.
- Follow platform conventions: native navigation transitions, back gestures, native modals, keyboard avoidance, safe areas.
- Maintain the same information architecture and copy keys.
- Respect reduced motion and dynamic type.
- Test with Hindi and Gujarati; native font loading differs from web and must be verified.
- Keep the same accessibility labels and reading order.

## 13. Testing the migration

- `packages/core` unit tests run unchanged for both apps.
- API contract tests are shared; both clients are type-checked against the same OpenAPI document.
- Native E2E with Detox or Maestro for critical journeys: register, OTP, onboarding, photo, verification, discovery, interest, chat, purchase, settings.
- Snapshot parity checks are not used; behaviour parity is verified by shared acceptance tests.
- Device matrix: low-end Android, mid-range Android, iPhone SE-class, recent iPhone.
- Payment tests in store sandboxes; entitlement restore across web and native.
- Push tests on physical devices.
- Performance: cold start, screen transition, list scroll and chat latency budgets.

## 14. Release plan

1. Internal TestFlight / Play internal testing with staff.
2. Closed beta with a small member cohort (feature-flagged).
3. Staged rollout (10% → 50% → 100%) with crash and payment monitoring.
4. PWA remains available; no forced migration.
5. Store listings, screenshots, privacy labels and data-safety forms completed before review.
6. Rollback plan: disable the native feature flag, direct members to the PWA.

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Logic duplicated in native | Enforce `packages/core` imports; lint rule against re-implementing domain rules |
| API drift between clients | Generated types + contract tests in CI |
| Auth differences break sessions | Shared token model, separate audiences, integration tests for both refresh paths |
| Store review rejection | Follow store billing and privacy rules; prepare review notes early |
| Native camera/KYC quality | Test on real devices; keep hosted KYC fallback |
| Push token churn | Prune stale tokens; fall back to SMS/email |
| Design divergence | Shared tokens and copy; design review per screen |
| Entitlement mismatch | Provider-agnostic entitlement service; restore-by-account tests |
| Migration takes longer than planned | Ship vertical slices; feature-flag each; PWA remains the fallback |

## 16. Migration trigger

**Primary trigger — confirmed:** the Expo migration starts only after the entire PWA (Phases 1–3) is complete. "Complete" means every PWA story is implemented, tested, reviewed and every acceptance criterion passes, and the Phase 3 exit criteria are met.

Before starting Phase 4, also confirm the operational conditions:

- Stable activation and retention for at least one quarter.
- A meaningful share of members attempt to install or ask for an app.
- Payment volume (when billing is enabled) justifies store fees and the overhead of two clients.
- The team has capacity to maintain both apps during the transition.

The PWA remains supported after Expo launches. If the primary trigger is not met, continue investing in the PWA.

## 17. Parity checklist

- [ ] Language selection and persistence.
- [ ] Registration, OTP, login, logout, logout-all, password reset.
- [ ] Full onboarding with autosave, resume, offline draft and completion.
- [ ] Photo upload, camera capture, moderation status.
- [ ] ID + selfie verification with retry and manual review.
- [ ] Submission, pending, changes requested, rejected, approved.
- [ ] Recommendations, search, filters, profile detail.
- [ ] Interests, shortlists, ignore, block, report.
- [ ] Contact reveal and entitlements.
- [ ] Chat with real-time delivery, read receipts, typing, mute, delete.
- [ ] Notifications and deep links on all channels.
- [ ] Plans, purchase, restore, cancel, invoice access.
- [ ] Biodata preview, download and share.
- [ ] Horoscope display and Guna Milan.
- [ ] Settings: privacy, language, notifications, sessions, export, delete.
- [ ] Accessibility, performance and crash-free targets met.
- [ ] No product rule exists only in the native app.

## 18. Acceptance checklist

- [ ] The native app reuses `packages/core` without forking domain logic.
- [ ] Platform capabilities sit behind the same interfaces as the PWA.
- [ ] Entitlements work across web, Android and iOS.
- [ ] Critical journeys pass native E2E tests on real devices.
- [ ] Push and deep links work for all critical events.
- [ ] Store billing follows platform policy and reconciles with the backend.
- [ ] The PWA remains supported and is not broken by the migration.
- [ ] Rollback via feature flag is tested.
- [ ] The migration is gated on a documented trigger.
