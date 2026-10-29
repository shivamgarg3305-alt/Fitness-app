# Health data architecture

Status: implemented in code. Not run on any device — everything about whether a permission
prompt, a HealthKit/Health Connect query, or the status screen actually works as described is
unverified. See "Verified and unverified" at the end.

## Mandatory Android Health Connect gate

This release treats **Android Health Connect as required** before onboarding or the main app:

1. Branded entry (`/health-setup`) with logo and product name.
2. User must allow **every** required Health Connect read (steps, distance, active calories, sleep, heart rate, resting HR, HRV, exercise sessions).
3. Partial grants are **denied** — there is no skip on Android.
4. After all grants succeed, the existing onboarding questions run, then the rest of the app.
5. If permissions are later revoked, the next foreground resume returns the user to `/health-setup`.

Apple Health remains implemented in code for a future iOS product path; this release’s entry gate does not treat HealthKit as a substitute for Health Connect. Browser preview can open onboarding only via an explicit “Open browser preview” control (not available on Android).

## Layering

```
platform source (HealthKit / Health Connect / a wearable's own cloud — see docs/wearables.md)
  -> permission layer   (apps/mobile/src/health: connectPlatformHealth, request*PermissionsAsync)
  -> platform adapter   (apps/mobile/src/health/native.ios.ts, native.android.ts)
  -> normalized sample  (packages/domain/src/health.ts: NormalizedHealthSample, normalizeHealthSample)
  -> domain layer       (packages/domain/src/samples.ts's multi-source daily totals;
                          recovery.ts / sleep.ts, unchanged by this phase)
  -> UI / coach         (apps/mobile screens; the AI coach's context builder, unchanged — see below)
```

This phase did not invent this shape — Phase 1 already built the permission-layer/adapter split
for steps, sleep, resting heart rate, and HRV. This phase:
- extends the adapter with distance, active energy, and read-only external workouts,
- adds the normalized-sample and dedup layer that was missing above the adapter,
- **discovers and wires up `packages/domain/src/samples.ts`**, which already existed with a
  multi-source dedup algorithm (including `apple_watch`, `fitbit`, `garmin` as source types) but
  was never imported anywhere in the app — this phase generalizes it from steps-only to also
  cover distance and active energy, without changing its behavior for existing steps-only callers
  (the existing `domain.test.ts` test for it was re-run by hand and still passes unchanged).

## What is new

| Metric | iOS source | Android source | Notes |
| --- | --- | --- | --- |
| Steps | HealthKit (Phase 1) | Health Connect (Phase 1) | Unchanged |
| Sleep | HealthKit (Phase 1) | Health Connect (Phase 1) | Unchanged |
| Resting HR / HRV | HealthKit (Phase 1) | Health Connect (Phase 1) | Unchanged |
| **Distance** | `HKQuantityTypeIdentifierDistanceWalkingRunning` | `Distance` record | New this phase |
| **Active energy** | `HKQuantityTypeIdentifierActiveEnergyBurned` | `ActiveCaloriesBurned` record | New this phase |
| **Workouts (read-only)** | `queryWorkoutSamples` | `ExerciseSession` record | Function and field names match the installed type definitions. Device reads are still unverified. |

Distance and active energy have **no phone-sensor fallback** the way steps has one (Core
Motion's pedometer only reports a step count) — without HealthKit/Health Connect access, these
two simply report `unavailable`, honestly.

## What is unverified, and how much

Every reader follows the same try/catch-to-`unavailable` shape, so a wrong runtime result fails
closed (honest "unavailable", never a crash or invented number).

**Type-checked against installed packages (11 Oct 2026):**
- `@kingstinct/react-native-healthkit@16.0.0` — `queryWorkoutSamples`, `queryStatisticsForQuantity`,
  workout `uuid` / `workoutActivityType` / `startDate` / `endDate` exist in package `.d.ts`.
- `react-native-health-connect@4.1.3` — `ExerciseSession`, `Distance`, `ActiveCaloriesBurned`,
  resting HR / HRV record shapes compile under `pnpm typecheck`.

**Still unverified on a physical device:** permission prompts, empty vs denied vs granted
behavior, and whether real samples match the mapped fields. Device verification is Step 8.

## Normalization and deduplication

`packages/domain/src/health.ts`:
- `normalizeHealthSample` rejects a non-finite or negative value, an unparseable timestamp, an
  end before its start, and a missing unit — returning `null` rather than throwing, so one bad
  sample from a misbehaving source never stops a batch.
- `dedupeHealthSamples` prefers a platform record id when one exists (the strongest "same
  record" signal a platform can give); only for samples without one does it fall back to an
  identical (metric, source, start, end, value) tuple.
- `isWorkoutAlreadyRepresented` / `newExternalWorkouts` decide whether an external workout (say,
  one an Apple Watch recorded on its own) overlaps a workout or activity already logged in
  VitaCore, so the same session is never shown as new twice. **This never writes to or alters
  VitaCore's own `workout_sessions`/`activity_sessions` tables** — it only filters a read-only
  list for the Health & Devices screen. Manually logged data is never overwritten.

`packages/domain/src/samples.ts` (extended, not rewritten): `dedupeDailyHealthSamples` merges
same-day samples from multiple sources for steps/distance/active-energy specifically (a
"sum the day, one source wins" metric shape) using a fixed source priority
(`apple_watch` > `healthkit` > `health_connect` > `garmin` > `fitbit` > phone sensors > `manual`).
Heart rate, HRV, and sleep are deliberately **not** run through this — they are not
same-day-sum metrics, and Phase 1 already gave them their own correct today-plus-baseline shape.

## Sync / privacy: a deliberate decision not to sync yet

The Supabase migration already has a `health_samples` table — `client_id`/`source_record_id`
unique constraints, RLS scoped to `user_id = auth.uid()`, ready to receive exactly the shape
`NormalizedHealthSample` produces. **It is intentionally left unused in this phase.**

Why: the instruction for this phase was explicit — sync only what is actually required, not
everything available. Nothing currently consumes server-side health samples: the AI coach
(Phase 7) was deliberately built to state that step count, heart rate, HRV, and recovery are
**not** available to it, precisely because nothing syncs them — wiring `health_samples` now
without a consumer would mean sending a phone's continuous heart-rate stream to a server for no
functional reason, which is the opposite of what a "highly sensitive, only what's needed" privacy
posture calls for.

**What is stored locally:** nothing new, persistently — samples are read live from
HealthKit/Health Connect each time a screen needs them (the same pattern Phase 1 established for
steps/sleep/HR/HRV). The Health & Devices screen persists exactly one small preference value
(`health_last_successful_read_at`, a timestamp) in the existing local `preferences` table, purely
so the status screen can say when it last read successfully — this is not health data itself.

**What is stored remotely:** nothing from this phase. The `health_samples` table remains empty.

**If a later phase wires this up**, it should: batch samples locally, run them through
`normalizeHealthSample`/`dedupeHealthSamples` before upload, map to `health_samples`' columns
(`client_id`, `source`, `metric`, `source_record_id`, value/unit/timestamps), upload through the
existing Phase 2 sync-worker pattern (RLS-scoped client, never the service role), and — given the
volume a continuous heart-rate stream implies — almost certainly needs its own batching/interval
strategy rather than one outbox row per sample.

## AI coach compatibility

Phase 7's coach context builder (`packages/domain/src/coach.ts` /
`supabase/functions/_shared/coach-logic.ts`) is **unchanged** by this phase. It already states
explicitly that step count, heart rate, HRV, and recovery are not available to it — which remains
true, since this phase does not sync any of that data server-side (see above). The normalized
`NormalizedHealthSample` shape this phase introduces is what a future phase would feed into the
coach's context once (and if) that data starts syncing; duplicating the coach's context logic was
not necessary and was not done.

## UI: Health & Devices screen

`apps/mobile/src/app/health.tsx`, reachable from Profile:
- States the real platform (Apple Health / Health Connect / "not available" in the browser
  preview) and a real status line via `describeHealthConnection`.
- **iOS and Android are not assumed identical.** HealthKit deliberately never reports whether a
  *read* permission was individually denied (Apple's documented privacy design — this is not a
  bug in this app, it is how HealthKit works) — so on iOS this screen can only ever say
  "connected, but what was granted isn't reported back; check Settings" (with a direct button to
  open Settings), never a specific "steps: denied". Health Connect on Android does report
  granted/denied accurately, so Android's status line is more precise.
- Shows the last successful read time, from the one persisted preference described above.
- Shows recent external workouts, filtered through `newExternalWorkouts` so one already logged in
  VitaCore is not duplicated — read-only, clearly labeled as such.
- Lists WHOOP/Fitbit/Garmin/Apple Watch with their real status from `docs/wearables.md`, as plain
  text — no non-functional "Connect" button for something that cannot actually connect yet.
- No fake connected state, anywhere: if `connectPlatformHealth()` reports unavailable/denied, the
  screen says exactly that.

## Verified and unverified

**Automated checks passed on the working branch.** GitHub Actions run
[38086643274](https://github.com/pappu33005-lab/Fitness-app/actions/runs/38086643274)
completed successfully on 10 October 2026. The workflow installed dependencies, type-checked all packages,
ran the repository's automated tests, and linted the mobile app. This verifies the current TypeScript and
automated-test suite; it does **not** prove the Android Health Connect APIs work on a real phone.

**Implemented in code:**
- Android manifest declarations for every Health Connect record type requested by VitaCore.
- A non-prompting status check that reads the permissions actually granted in Health Connect, so the
  Health & Devices screen can display existing connection status when opened.
- A separate explicit action to request/review access. The app does not claim that permission access is
  connected merely because the user opened the screen.
- Today's distance and active-energy readings are surfaced on the Health & Devices screen with honest
  empty/unavailable states; the existing dashboard continues to read steps, sleep, resting heart rate,
  and HRV. Recent external workouts remain read-only.
- Android step reading no longer calls Expo's historical Pedometer.getStepCountAsync path, which is
  not a supported Android historical-query API. When Health Connect has no step records, VitaCore says
  that plainly rather than pretending it obtained a phone-wide daily total.

**Still requires a physical Android device and a native development/preview build:**
1. Confirm Health Connect is installed/available and the permission screen opens.
2. Grant only Steps, then confirm the UI reports partial access honestly and the steps query works.
3. Deny all requested access, reopen the screen, and confirm it reports access off rather than connected.
4. Re-enable access in Health Connect settings, return to VitaCore, and confirm status refreshes without
   reinstalling the app.
5. Confirm actual values and empty states for steps, distance, active calories, sleep, resting heart rate,
   HRV, and external workouts using records already present in Health Connect.
6. Confirm a missing individual permission produces a clear unavailable state for that metric, without
   crashing or blocking metrics whose permissions were granted.

A compatible Android build and device were not available to this code-only workflow, so Phase 2 is
**automated-check verified, but not yet physically device-verified**. Do not mark Health Connect as
fully verified until this checklist is run on an Android phone.

**iOS is outside this phase's verification scope.** The shared status-screen improvements preserve
HealthKit's documented limitation that the app cannot inspect individual read grants; this phase does not
claim that Apple Health has been tested. Direct WHOOP, Fitbit, and Garmin APIs are also out of scope here;
see `docs/wearables.md`.
