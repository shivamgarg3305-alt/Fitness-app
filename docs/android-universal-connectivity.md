# Android-first universal wearable connectivity

Status: implementation in progress. This document defines the order of work; it does not claim that every watch is supported.

## Product requirement

VitaCore should accept health and fitness data from as many wearable ecosystems as practical. Android is the first platform. The architecture uses two routes:

1. **Local aggregator:** read supported records from Android Health Connect after the user grants per-record permissions.
2. **Direct provider adapters:** use official provider APIs only where access is available and justified, with OAuth and all provider secrets/tokens handled server-side.

A brand must never be displayed as connected just because its name appears in the app. A connection is successful only after authorization and a real read/sync succeeds.

## Android Health Connect route

A user first pairs the watch with its companion app. If that app publishes data to Health Connect, VitaCore requests access to the specific record types it needs and reads those records locally. Coverage depends on the companion app, watch model, firmware, Health Connect version, sync state, and permissions.

Examples of possible paths, subject to the companion app actually sharing data:

- Samsung Galaxy Watch -> Samsung Health -> Health Connect -> VitaCore
- Fitbit / Pixel Watch -> supported companion-app sync -> Health Connect -> VitaCore
- Noise, boAt, and other brands -> companion app -> Health Connect -> VitaCore, only if the app supports publishing the needed records
- Other Android health apps -> Health Connect -> VitaCore

These are possible data paths, not a guarantee that every product exposes every metric. If the companion app does not publish data to Health Connect, VitaCore must show an honest unsupported/empty state rather than invent values.

## Direct provider integrations

- **Garmin:** first direct API candidate, after the owner applies to and receives approval for the Garmin Connect Developer Program. Build against the granted documentation and evaluation environment, not guessed endpoints.
- **Fitbit / Google Health API:** do not start new code against the legacy Fitbit Web API. Google says it is not onboarding new Google Health API projects at this time. Revisit direct integration only when VitaCore has access.
- **WHOOP:** deferred. Do not require the app owner to buy a membership just to continue work.
- **Other brands:** evaluate one at a time. Prefer an official public API or a documented local aggregator route; do not scrape private APIs or collect user passwords for companion apps.

## Shared adapter contract

Each direct provider adapter should expose the same lifecycle and normalized data contract:

- not_configured, pending_consent, connected, syncing, needs_reauthorization, error, and disconnected states.
- Provider authorization and consent.
- Server-side token exchange, refresh, encryption at rest, revocation, and least-privilege scopes.
- A provider-specific sync job with pagination, retries, rate limits, and clear last-success timestamp.
- Validation and normalization into VitaCore domain samples.
- Idempotent deduplication using provider record IDs, with a careful fallback when no stable ID exists.
- User-visible disconnect and credential deletion/revocation.
- Logs and client responses must never include secrets or access/refresh tokens.

The local Health Connect adapter is separate from cloud provider adapters. Local Health Connect data should not be uploaded to Supabase unless a specific user-facing feature requires it and the user has been clearly informed.

## Current implementation baseline

- Android Health Connect reader code exists for steps, sleep, resting heart rate, HRV, distance, active calories, and read-only external workouts.
- Automated checks have passed on the working branch, but no physical Android device test has been completed yet.
- The Health & Devices screen now explains Android compatibility paths for Samsung Health, Fitbit/Pixel Watch, Noise/boAt, and Garmin without claiming those brands are directly connected.
- No direct Garmin or Fitbit cloud OAuth connection is enabled yet.
- iPhone/HealthKit improvements are intentionally deferred while Android is the priority.

## Acceptance criteria

1. Compatible Android device can open Health Connect, request only necessary permissions, and handle partial grants.
2. Empty data, unsupported Health Connect, denied permission, and missing companion-app sync have distinct honest UI states.
3. For each available source, the app can identify the record source when the platform exposes it.
4. Same-day steps/distance/calories from multiple sources do not double-count the same activity.
5. Direct-provider connections are not shown as connected before OAuth and a real successful sync.
6. Direct integrations use server-side token handling, per-user authorization, revocation, and documented provider approval.
7. CI passes, then the implementation is tested on a physical Android device before claiming completion.
