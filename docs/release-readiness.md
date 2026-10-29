# Release readiness (Milestone 5 + device checklist)

Status after the native-production milestone. Static checks and config hardening can pass here. Nothing below claims a feature worked on a physical phone or that an AAB/IPA was built.

For the Milestone 6 regression verdict and feature tracker, see `docs/RELEASE_AUDIT.md`.

## What this milestone changed in code

- Android Health Connect **read permissions** + package visibility query (`plugins/withAndroidNativeReadiness.js` and `app.config.ts`).
- `POST_NOTIFICATIONS` and `ACTIVITY_RECOGNITION` declared for Android 13+ reminders and pedometer fallback.
- `expo-sensors` motion usage string; iOS `NSMotionUsageDescription`.
- `expo-notifications` plugin defaults; EAS channels on development / preview / production.
- Permission recovery: open system / Health Connect settings from Health, Record, Reminders, and Scan when access is denied or blocked.
- Root + route error boundaries; empty states on Activity.
- In-app **Release readiness** screen (`/readiness`) driven by pure checks in `packages/domain/src/release.ts`.

## Automated verification (this environment)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Run during the milestone |
| `pnpm test` | Domain suite including `release.test.ts` |
| `pnpm lint` | Mobile ESLint |
| `npx expo config --type public` | Config must resolve |
| `eas build` | **Blocked** — no Apple / Google / EAS credentials here |

## Device checklist (not run here)

### iOS development build

1. Install a development build (not Expo Go).
2. Google sign-in → onboarding → home.
3. Health & Devices → Connect → grant HealthKit → confirm steps/sleep stay blank rather than invented when empty.
4. Record a short walk with While Using location; optionally grant Always and lock the screen briefly.
5. Reminders → enable one type → confirm the system permission prompt and a scheduled local notification.
6. Scan a barcode (or deny camera and use Open Settings recovery).

### Android development build

1. Install a development build with Health Connect available (Android 9+; framework-integrated on 14+).
2. Repeat Health Connect connect / deny / Open Health Connect settings recovery.
3. Background location + foreground-service notification while recording.
4. Notification permission (API 33+) via Reminders.
5. Confirm Play Console health declaration is still **not** submitted from this repo.

## Store blockers (external)

- Privacy policy URL
- Apple App Privacy nutrition labels
- Android Data Safety form
- Health Connect data-access declaration in Play Console
- Live Supabase project + RLS proof
- Optional MapLibre HTTPS style URL

## Related docs

- `docs/platforms.md`
- `docs/health.md`
- `docs/notifications.md`
- `docs/DEVICE_TEST_READY.md`
