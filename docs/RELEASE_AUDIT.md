# VitaCore — Milestone 6 release audit

**Date:** 28 Oct 2026 (Asia/Calcutta)  
**Branch:** `cursor/release-audit-41cb`  
**Scope:** Full regression of automated checks, security/config review, and an honest store-readiness verdict.  
**Not claimed:** physical-device verification, successful EAS/AAB/IPA builds, or live Supabase/Gemini runs.

## Verdict

**Not store-ready.** The codebase is a coherent pre-device checkpoint: automated domain tests and typecheck/lint pass, RLS is declared in migrations, and no secrets were found in the repo. Store submission is blocked on credentials, privacy/legal forms, live backend proof, and physical-device native verification.

## Automated checks (this environment)

| Check | Result | Notes |
| --- | --- | --- |
| `pnpm typecheck` | PASS | brand, domain, mobile |
| `pnpm test` | PASS | 231+ domain tests (includes release tracker) |
| `pnpm lint` | PASS | `expo lint` |
| `npx expo config --type public` | PASS | After plugin require fix (`expo/config-plugins`) |
| `npx expo config --json --full` | PASS | Same fix; previously failed under `expo-doctor` |
| `npx expo-doctor` | PASS | **21/21** after Expo patch alignment + `expo-asset` plugin |
| `eas build` | BLOCKED | No Apple / Google Play / EAS credentials |
| Secret scan | PASS | No committed service-role / Gemini / live JWT secrets; warnings only in docs |

Run a fresh stamp: `bash scripts/release-audit.sh` → `docs/audit-stamps/`.

## Security & privacy (code review)

| Item | Finding |
| --- | --- |
| Client secrets | No `.env` in repo. Mobile uses only `EXPO_PUBLIC_*`. Gemini key is Edge-Function-only. |
| RLS | Enabled on all user tables in `0001_foundation.sql` with `auth.uid()` policies. `0003` tightens `ai_messages` to conversation ownership. |
| Live RLS proof | **Not run** — no Supabase project in this environment. |
| Sync model | Upload/backup after explicit local-data claim. New-device restore **not implemented**. |
| Health samples remote | Table + RLS exist; intentionally unused (no metric sync). |

## Account / offline / history (code-level)

| Flow | Code status | Verified here? |
| --- | --- | --- |
| Google sign-in → onboarding → app | Implemented; no guest CTA | No (needs Supabase + Google) |
| Local claim of guest SQLite data | Explicit confirm before bind | Domain/sync tests only |
| Offline workout/nutrition writes | SQLite immediate + outbox | Domain tests; no crash-kill device test |
| Workout / nutrition history charts | Local history series | Domain history tests |
| Native permissions | Declared + recovery UX | Config only |

## Feature status tracker

Statuses follow the handover vocabulary. **None are `verified_on_physical_device`.**

See `packages/domain/src/release.ts` → `featureStatusTracker()` and Profile → **Release readiness**.

Summary categories (empty Supabase env):

- Verified in automated tests: design-adjacent domain features (onboarding, workouts domain, nutrition domain, hydration, sleep score, recovery score, GPS domain, analytics, offline patterns, streaks/PRs, programs, reminder planning)
- Implemented — not verified: design UI, dashboard, exercise media placeholders, HealthKit/Health Connect adapters, permissions UX, share sheet, security review without live proof
- Blocked: auth (without env), wearables, AI coach, cloud sync restore path, Android/iOS release binaries, store submission
- Not started: smart alarm

## Remaining blockers (ordered)

1. Apple Developer + Google Play + EAS project credentials → development builds  
2. Supabase project: apply migrations `0001`–`0003`, enable Google Auth, set mobile `EXPO_PUBLIC_*`, deploy `ai-coach` with `GEMINI_API_KEY`  
3. Physical device matrix: HealthKit, Health Connect, background GPS, notifications, camera, share sheet  
4. Privacy policy URL + Apple App Privacy labels + Android Data Safety + Health Connect Play declaration  
5. Optional: MapLibre HTTPS style URL; decide Gemini cost posture before enabling coach in production  
6. Keep Expo packages aligned (`npx expo-doctor` is green as of this audit; re-check after dependency changes)

## Milestone stack

1. Glass design — PR #2  
2. Auth / onboarding — PR #3  
3. Retention — PR #4  
4. Exercise experience — PR #5  
5. Native readiness — PR #6  
6. This audit — PR on `cursor/release-audit-41cb`

## Final principle

Code present ≠ feature verified ≠ store-ready. VitaCore is ready for **credentialed development builds and device QA**, not App Store / Play submission.
