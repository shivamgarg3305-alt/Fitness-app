# VitaCore release readiness

Last code-side audit pass: 2026-10-28 (UTC). Physical-device and store submission remain open.

## Overall status: **conditionally ready**

Ready for an Android development/device QA build once Health Connect is exercised on hardware. Not ready for store submission.

## Platform matrix

| Area | Android | iOS | Web |
| --- | --- | --- | --- |
| Mandatory Health Connect gate | Implemented (device UNVERIFIED) | Explainer only (Apple Health planned) | Preview-only escape |
| Onboarding (10 steps) | After health grant | Blocked on setup explainer | After explicit preview |
| Local SQLite + outbox | Implemented | Implemented | Preview persistence limits |
| Store listing / signing | BLOCKED | BLOCKED | N/A |

## Required manual setup

1. Android device or emulator with Health Connect installed.
2. Development build (not Expo Go) so `react-native-health-connect` is linked.
3. Grant every VitaCore Health Connect permission when prompted.
4. Supabase project + Google OAuth (existing) for account/coach.
5. Optional MapLibre style URL for base maps.
6. Privacy policy URL and data-safety form for Play Console.
7. Play App Signing + upload key; iOS Apple Developer + HealthKit capability when iOS ships.

## Potential costs

- Google Play developer fee (one-time).
- Apple Developer Program (annual) when iOS ships.
- Supabase free tier may suffice initially; watch auth/DB/egress.
- Gemini via Edge Function — confirm free-tier quota; paid usage if quota exceeded.
- Map tiles if using a paid style host (OpenFreeMap default is free-oriented).

## Store blockers

**Android:** device QA for Health Connect gate, notifications/alarms, GPS background, camera barcode; Play Data safety + Health Connect declaration; signed AAB.

**iOS:** product gate currently Android-first; HealthKit path not the mandatory entry; certificates, privacy nutrition labels, TestFlight — BLOCKED for this release intent.
