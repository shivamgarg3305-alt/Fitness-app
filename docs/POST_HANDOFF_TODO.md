Ranked by technical necessity for correctness/reliability/release readiness — not by business
value. "CRITICAL" means the app cannot be trusted to work at all until it's resolved; "FUTURE
FEATURES" means genuinely optional, no-rush work.

## CRITICAL

- [x] Get `pnpm install` to succeed somewhere with network access. Passed on 1 Oct 2026 with pnpm 12.6.0.
- [x] Run `pnpm typecheck` for real and fix every error. Passed after the repairs in this pass. HealthKit and Health Connect field names were checked against the installed type definitions (`@kingstinct/react-native-healthkit` 16.0.0 and `react-native-health-connect` 4.1.3). Device reads remain unverified.
- [x] Run `pnpm test` for real. Passed: 8 files, 175 tests.
- [x] Resolve and install `@maplibre/maplibre-react-native` (11.4.0, with the Expo config plugin) and align `expo-task-manager` to `~57.0.21`. Tiles still need a development build.
- [ ] Create a real Supabase project, apply `supabase/migrations/0001_foundation.sql`, and
      confirm RLS actually isolates users — don't just trust the policy SQL by inspection.
      **Owner / live-service step** — cannot be finished in code alone.
- [x] Verify `readRecentWorkouts` against installed package TypeScript types on both platforms.
      **Done (types):** `queryWorkoutSamples` / `WorkoutSample` fields match
      `@kingstinct/react-native-healthkit@16.0.0`; `ExerciseSession` / `exerciseType` match
      `react-native-health-connect@4.1.3`. **Still REQUIRES DEVICE** for a live permission +
      sample read.

## HIGH

- [ ] Verify background GPS with the screen locked, on both a real iPhone and a real Android
      phone — this was never run once.
- [x] Verify every other HealthKit/Health Connect reader against the real installed package
      types (resting HR, HRV, distance, active energy).
      **Done (types, 11 Oct 2026):** readers compile against installed package `.d.ts` files;
      `pnpm typecheck` passes. **Still REQUIRES DEVICE** for live reads.
- [x] Decide on delete-sync propagation for Phase 2/6 (deleting a food/water entry currently
      only removes it locally, never remotely) — either build it or explicitly document it as a
      permanent product decision.
      **Done:** food/water deletes enqueue remote `delete` outbox ops (`user_id` + `client_id`).
- [x] Confirm the Gemini model id (`gemini-3.8-flash`) is still current at build time.
      **Done (docs check, 11 Oct 2026):** Google AI docs list `gemini-3.8-flash` as GA/stable.
      Introductory **paid** pricing is documented through 31 Dec 2026 — not a confirmed free quota.
      Live coach still **REQUIRES EXTERNAL SERVICE**.
- [ ] Run the AI coach end to end against a live Supabase project + real Gemini key: conversation
      reuse, history windowing, personalized context, rate limiting, timeout, and the mobile
      chat UI's retry/history-list behavior.
      **Owner / live-service step.**
- [x] Decide whether `activity_points`'s lack of a `client_id` column is worth a migration to add
      one, instead of the current local-UUID-as-remote-id workaround.
      **Done:** `client_id` added in `0001` / `0002`; upserts use `user_id,client_id`.
- [ ] Privacy policy + Apple App Privacy nutrition labels + Android Data Safety form +
      background-location usage justification for both stores — required before any store
      submission, not started.

## MEDIUM

- [x] Decide whether to wire `health_samples` (table exists, unused) into the Phase 2 sync
      pipeline, and if so, design a batching strategy — a naive one-outbox-row-per-sample
      approach will not scale to a continuous heart-rate stream.
      **Done (product decision):** leave unused for Steps 1–7. Sensitive health streams stay
      local until a future phase designs batching and a real consumer. Documented in
      `docs/health.md` / `docs/limitations.md`.
- [ ] Add a mobile-app-level test runner (Jest/Detox/etc.) — currently all automated testing is
      in `packages/domain` only; every screen is untested by any automated process.
- [x] Decide the fate of the 11 `package.json` dependencies with no matching import anywhere in
      `src/` (listed in `docs/HANDOFF_TO_CURSOR.md` section 21) — remove, or confirm intentional
      and document why.
      **Done (code-side):** keep Expo/RN platform packages that Metro/Expo Router/config plugins
      expect (`expo-constants`, `expo-linking`, `expo-font`, `expo-system-ui`, `react-native-screens`,
      gesture/worklets peers, web preview peers). Do not bulk-delete them from a source-import scan.
      Optional UI-only packages (`expo-image`, `expo-glass-effect`, `expo-symbols`, `@expo/ui`) remain
      available scaffolding; removing them is deferred until a dedicated dependency-trim pass after
      device builds exist.
- [ ] Consider eliminating the `coach.ts`/`coach-logic.ts` duplication once a real Supabase CLI
      is available to test whether a Deno edge function can import `packages/domain` directly.
- [ ] Tune the reminder-notification debounce/retry intervals (Phase 5) once real usage data
      exists — current values (2s debounce, 60s periodic resync) were reasoned defaults, never
      measured.
- [ ] Measure actual battery impact of background GPS and tune `accuracy`/`timeInterval`/
      `distanceInterval` if needed — current values were a starting point, not measured.

## LOW

- [x] Quiet hours currently only apply to hydration reminders, not workout/goal reminders —
      revisit if that's the intended final behavior or should be extended.
      **Done:** workout and goal reminders are skipped when their time falls in quiet hours.
- [ ] Review whether the 28-day trailing baseline window for resting HR/HRV (Phase 1) is the
      right length, once real user data exists to judge against.
- [ ] Review notification copy variety (currently a small rotating set of 2–3 phrasings per
      reminder type) once real usage exists to judge repetitiveness.

## FUTURE FEATURES

- [ ] watchOS companion app for on-wrist features (starting a workout from the wrist, live
      stats) — a separate Xcode target, standalone project, not a correctness gap in the current
      app.
- [ ] WHOOP integration — requires a registered WHOOP developer app and OAuth infrastructure
      (see `docs/wearables.md`).
- [ ] Fitbit direct-API integration — requires a registered developer app (also check first
      whether a given user's Fitbit already writes into Health Connect, which may make this
      unnecessary).
- [ ] Garmin integration — requires applying to and being approved for Garmin's Connect
      Developer Program; not something to start until that approval exists.
- [ ] True smart-alarm functionality (reading overnight sleep signal to choose a wake moment in
      a window) — explicitly not built; what exists today is a fixed-time goal reminder only.
