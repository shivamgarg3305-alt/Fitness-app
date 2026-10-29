# Third-party wearables: Phase 3 implementation status

Last reviewed: 11 October 2026.

## Honest status

**Phase 3 is in progress, not complete.** The repository now has a database migration that allows WHOOP to be represented in the wearable connection registry. No direct WHOOP, Fitbit/Google Health, or Garmin data connection is enabled yet. The app must not claim a provider is connected until OAuth/consent, server-side token handling, a real data fetch, and a physical end-to-end test succeed.

This is an external-access dependency, not a reason to fake data or use unofficial scraping.

## WHOOP — best first direct integration

Official documentation:
- [Developer overview](https://developer.whoop.com/docs/developing/overview/)
- [OAuth 2.0](https://developer.whoop.com/docs/developing/oauth/)

WHOOP supports OAuth 2.0. Before implementation can be exercised against a real account, the project owner must create a WHOOP developer app, register a redirect URI, select only the scopes VitaCore needs, and supply the client ID and client secret. WHOOP says developer access requires a WHOOP membership. The secret must remain server-side and must never be put in the mobile app, GitHub, or chat.

The OAuth flow must use a cryptographically random, short-lived, one-time `state` tied to the signed-in VitaCore user. Token exchange and refresh must happen server-side. WHOOP's `offline` scope is needed for refresh tokens; WHOOP rotates refresh tokens, so the latest token must replace the old one atomically. Tokens must be encrypted at rest, omitted from logs and API responses, and revocable when a user disconnects. The current repository does not yet implement these pieces, and this document does not claim otherwise.

## Fitbit — blocked on Google Health API access

Official documentation: [Google Health API](https://developers.google.com/health).

As of 11 October 2026, Google says the legacy Fitbit Web API is unsupported after 30 September and will be turned off on 30 October 2026. Google also says it is not onboarding new Google Health API projects at this time. Therefore VitaCore should **not** start a new integration against the legacy Fitbit API. Direct Fitbit integration is blocked until Google grants the project access to the Google Health API. If a Fitbit device writes data into Android Health Connect on a user's phone, VitaCore's existing Health Connect reader may read those permitted records; that is a separate, device-dependent local path and is not a direct Fitbit API integration.

## Garmin — blocked on program approval

Official documentation:
- [Garmin Connect Developer Program — Health API](https://developer.garmin.com/gc-developer-program/health-api/)
- [Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/)

Garmin describes the Health API as an approved developer-program integration and says an evaluation environment is available after approval. Commercial use requires a license fee. The project owner must submit the program request and confirm the applicable licensing terms. Until access and documentation for this specific project are granted, no direct Garmin API code can be validated or truthfully marked working.

## Apple Watch

No separate direct Apple Watch cloud integration is needed for the phone's health metrics: VitaCore reads data the Watch has already written to Apple Health through HealthKit. That existing local platform connection is distinct from a watchOS companion app, which has not been implemented.

## Security and privacy requirements for the implementation

- Never put provider client secrets or user access/refresh tokens in the mobile app, source control, or chat.
- Never use a Supabase service-role key in the mobile app.
- OAuth callback state must be random, short-lived, single-use, and tied to the initiating signed-in user.
- Request least-privilege scopes and explain the requested data to the user.
- Encrypt provider tokens at rest; do not log tokens or return them to clients.
- Validate provider responses and normalize data before saving; deduplicate by provider record ID where available.
- Use user-scoped access controls for connection status and data. Disconnect must revoke/delete credentials and stop future sync.
- No fake values, fake connection status, or unofficial scraping.

## Changes in this phase

- Added `supabase/migrations/0004_whoop_provider_support.sql` to allow `whoop` as a provider in `public.wearable_connections`. This table is explicitly for connection status only; it must not store tokens.
- No provider tokens or credentials were added.
- No real OAuth flow, token storage, data sync, or provider connection has yet been implemented or tested.

## Remaining work / account-owner actions

1. **WHOOP:** create a developer app, configure a redirect URI, choose minimum scopes, and keep the client secret ready to enter directly into Supabase Edge Function Secrets (never send it in chat).
2. **Garmin:** submit the Garmin Connect Developer Program application and wait for approval / terms.
3. **Fitbit:** wait until Google Health API new-project onboarding is open or VitaCore is granted access.
4. After those prerequisites, implement and test provider-specific OAuth, encrypted token storage/refresh/revocation, data normalization, sync, disconnect, and user-visible error states.
5. Run GitHub Actions and then test with real provider accounts. CI alone cannot prove external OAuth works.

**Current result:** database groundwork committed on the working branch. Direct integrations remain blocked by credentials and/or provider approval; Phase 3 must not be called complete yet.
