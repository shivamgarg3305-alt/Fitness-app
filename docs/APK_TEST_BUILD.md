# Android test APK (EAS, pnpm monorepo)

Use branch **`vitacore/backend-audit-fixes`** (or your latest feature branch that includes `apps/mobile/eas.json` and `app.config.ts`).

This app is a **pnpm monorepo**. EAS must install from the **repository root** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packages/*`). Do **not** treat `apps/mobile` as a standalone npm project.

## One-time setup (Codespaces)

```bash
cd /workspaces/Fitness-app   # repo root — not only apps/mobile
git checkout vitacore/backend-audit-fixes
git pull origin vitacore/backend-audit-fixes

corepack enable
pnpm install
```

Set Expo auth (pick one):

```bash
export EXPO_TOKEN="your-token-from-expo.dev"
# or: npx eas-cli login
```

In [Expo → Project → Environment variables](https://expo.dev), for the **preview** environment, set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Optional: `EXPO_PUBLIC_MAP_TILE_STYLE_URL`

Project ID in repo: `151e9e78-075f-4d80-b81e-ccc02208ba2f` (`apps/mobile/app.config.ts`).

## If EAS failed at “Read app config”

Your screenshot often matches **local files that should not exist**:

| File | Problem |
|------|---------|
| `apps/mobile/app.json` | Conflicts with **`app.config.ts`** (this repo uses only `app.config.ts`). **Delete it.** |
| `apps/mobile/package-lock.json` | From `npm install` in `apps/mobile`. EAS may pick **yarn/npm** and miss the root `pnpm-lock.yaml`. **Delete it.** |
| `npm install` inside `apps/mobile` only | Wrong for this monorepo. Run **`pnpm install` at repo root** only. |

Clean and verify **before** rebuilding:

```bash
cd /workspaces/Fitness-app
rm -f apps/mobile/app.json apps/mobile/package-lock.json

pnpm install
cd apps/mobile
npx expo config --type public
npx expo-doctor
```

If `expo config` fails locally, EAS will fail the same way — fix that first.

Ensure **`.git` is at the repo root**, not inside `apps/mobile` (otherwise EAS may not see the monorepo).

## Build the test APK

```bash
cd /workspaces/Fitness-app/apps/mobile
npx eas-cli whoami
npx eas-cli build --platform android --profile preview --non-interactive
```

Profile **`preview`**: internal distribution, **APK** (`android.buildType: apk` in `eas.json`).

When the build finishes, open the URL from the CLI (or [expo.dev](https://expo.dev)) on your Android phone, scan the QR code, and install the APK.

## Install on device

- Allow installs from the browser or file manager (“unknown apps”) if Android prompts you.
- This is **not Expo Go** — it is a native build (Health Connect, background location, camera, etc.).

## After testing

Note what works and what does not (Step 8 in `docs/CURSOR_START_HERE.md`) and feed that into your next Cursor session on the same branch.
