# Live setup checklist (master)

Permanent branch: **`master`**.

## Verified against your project (automated)

| Check | Result |
| --- | --- |
| Supabase URL + publishable key | OK — tables respond |
| SQL migrations / RLS tables | OK |
| Google provider enabled | OK — `/auth/v1/settings` shows `google: true` |
| Google OAuth authorize | OK — redirects to Google with your Web client ID |
| `ai-coach` Edge Function | **DEPLOYED** (`ACTIVE`) — returns 401 without a signed-in user (expected); Gemini secret set |
| Map tile style URL | Empty — GPS routes use outline (correct until you add a MapLibre HTTPS style) |
| `pnpm typecheck` / `test` / `lint` / `expo-doctor` | PASS on master |

## You still do once (dashboard / CLI)

### 1. Deploy AI coach + Gemini secret

Option A — CLI (from repo root):

```bash
export GEMINI_API_KEY='your-key'
export GEMINI_MODEL=gemini-3.8-flash
export SUPABASE_ACCESS_TOKEN='sbp_…'   # from https://supabase.com/dashboard/account/tokens
bash scripts/deploy-ai-coach.sh
```

Option B — Dashboard:

1. Edge Functions → Create / deploy `ai-coach` using `supabase/functions/ai-coach/index.ts`
2. Project Settings → Edge Functions → Secrets:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` = `gemini-3.8-flash`

### 2. Confirm Google Auth URLs

Supabase → Authentication → URL Configuration — allow:

- `vitacore://auth/callback`
- `https://offtlxnmbeobzaguclip.supabase.co/auth/v1/callback`

Google Cloud OAuth client → Authorized redirect URI:

- `https://offtlxnmbeobzaguclip.supabase.co/auth/v1/callback`

### 3. Optional map tiles

Set `EXPO_PUBLIC_MAP_TILE_STYLE_URL` (HTTPS MapLibre style) in `.env` / `public-env.ts` when you have a licensed style. Until then, Record + Activity detail draw the GPS outline.

### 4. Device builds

HealthKit, Health Connect, background GPS, camera barcode, and notification delivery need an EAS development build on a phone — not Expo Go / browser alone.
