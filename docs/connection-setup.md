# VitaCore connection and completion checklist

This is the owner-operated setup guide for connecting the app to real services. Code existing in the repository is not evidence that a cloud service is configured or running.

## 1. Supabase project

1. Create or open the Supabase project for VitaCore.
2. In **Project Settings → API**, copy the Project URL and the **publishable** key (or legacy anon/public key if that is what the project exposes).
3. In the root `.env` file, set:
   - `EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY`
4. Apply every SQL migration in `supabase/migrations/` in numeric order, once per project, using the Supabase SQL Editor or Supabase CLI. Read the SQL before running it on a project that already has user data. Do not apply migrations out of order.
5. Enable the authentication providers the app actually offers in its sign-in UI, and configure their callback URLs for the app scheme. Do not enable a provider in the dashboard unless its OAuth credentials and redirect settings are configured.
6. Confirm RLS is enabled on every table in `supabase/migrations/0001_foundation.sql` and that later migrations have been applied.

**Never send a service-role key, database password, access token, or OAuth client secret in this chat or put one in the mobile app.** A publishable key is intended to be public, but RLS is what protects each user's rows.

## 2. AI Coach / Gemini

1. Create a Gemini API key in the Google AI developer console and check its current model availability, rate limits, and pricing for your account.
2. In Supabase **Edge Functions → Secrets**, add `GEMINI_API_KEY` as a secret. Optionally add `GEMINI_MODEL` only after confirming that exact model id is enabled for your key.
3. Deploy `supabase/functions/ai-coach/index.ts` as the Edge Function named `ai-coach`. It expects Supabase's injected `SUPABASE_URL` and `SUPABASE_ANON_KEY` and a valid signed-in user's Authorization header. Do not add the Gemini key to `.env`, EAS public variables, app config, or source control.
4. The Edge Function uses the caller's user-scoped JWT for RLS. Do not replace it with a service-role client.
5. If deployment fails, capture the non-secret error text from Supabase. Never share the key itself.

## 3. Route map tiles

The route outline works without a tile provider. To show streets and labels, choose a MapLibre-compatible style provider whose plan permits your intended usage, then set:

`EXPO_PUBLIC_MAP_TILE_STYLE_URL=https://YOUR_PROVIDER/your-style.json`

Use HTTPS. If the URL contains a provider token, restrict it to the app where the provider supports restrictions and set usage limits. The URL is bundled into the client and is not a secret. Rebuild the native app after changing the variable or native map package/config.

## 4. Environment variable locations

- Local development: root `.env`, based on `.env.example`; never commit real values.
- EAS builds: set the three `EXPO_PUBLIC_*` variables in the appropriate EAS environment for development/preview/production. These values are public in the app bundle.
- Supabase Edge Functions: set `GEMINI_API_KEY` and optional `GEMINI_MODEL` in the Supabase project secrets, not EAS.

## 5. Current feature boundaries

- Cloud sync is currently upload/backup-first. A safe new-device restore path must be implemented before claiming full cloud restore support.
- The Coach reads data that has successfully synced to Supabase; local-only data is not automatically available to the Edge Function.
- The map outline can show a recorded route without tiles; base-map tiles need a style URL and native build.
- Native HealthKit, Health Connect, background GPS, notification behavior, and MapLibre require a development build and device-level testing later.
- Direct WHOOP/Fitbit/Garmin OAuth integrations and a standalone watchOS app require provider accounts/approvals and additional platform work. Existing Apple Health/Health Connect readers are not equivalent to direct integrations.
- Snoring detection, sleep-stage inference from microphone audio, and smart-alarm timing are not present merely because the sleep screen exists.

## 6. Safe information to provide when asking for setup help

You may share the Supabase Project URL, the publishable key, a MapLibre style URL, screenshots of dashboard settings, and non-secret deployment error messages. Do not share the Gemini key, Supabase service-role/secret key, database password, auth tokens, or OAuth client secrets.
