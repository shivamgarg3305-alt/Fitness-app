# Android test APK (EAS, pnpm monorepo)

Use the branch that contains the current `apps/mobile/eas.json` and `app.config.ts`.

This app is a **pnpm monorepo**. EAS must install from the **repository root** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packages/*`). Do **not** treat `apps/mobile` as a standalone npm project.

## One-time setup

```bash
cd /path/to/Fitness-app   # repo root — not only apps/mobile
corepack enable
pnpm install              # uses packageManager pnpm@12.6.0
```

Set Expo auth (pick one):

```bash
export EXPO_TOKEN="your-token-from-expo.dev"   # Access tokens → https://expo.dev/settings/access-tokens
# or: npx eas-cli login
```

Confirm account and project:

```bash
cd apps/mobile
npx eas-cli whoami
npx eas-cli project:info
```

If `project:info` says the configured project ID does not exist, do **not** invent an ID. Create or link the project while logged into the correct Expo account (`npx eas-cli init`), then update `extra.eas.projectId` in `app.config.ts` only with the ID Expo shows you.

In [Expo → Project → Environment variables](https://expo.dev), for the **preview** environment, set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Optional: `EXPO_PUBLIC_MAP_TILE_STYLE_URL`

Expo project: `@shivamjjje/vitacore`  
Project ID: `a433b256-f33c-4ad3-ac69-ccaef115cb86` (`apps/mobile/app.config.ts` → `extra.eas.projectId`).  
Android application ID: `app.vitacore.mobile` (from `packages/brand/brand.json`).

## If EAS failed at “Read app config” / “expo is not installed”

| File / action | Problem |
| --- | --- |
| `apps/mobile/app.json` | Conflicts with **`app.config.ts`**. **Delete it.** |
| `apps/mobile/package-lock.json` / `yarn.lock` | Wrong package manager → EAS may miss the root `pnpm-lock.yaml`. **Delete them.** |
| `npm install` inside `apps/mobile` only | Wrong for this monorepo. Run **`pnpm install` at repo root** only. |
| Missing Node pin / wrong EAS image | Older images ship Node **18.18.0**, which fails `engines.node >=22.13.0`. All profiles now extend `base` with Node `22.23.1`, pnpm `12.6.0`, and `image: sdk-57`. |

Clean and verify **before** rebuilding:

```bash
cd /path/to/Fitness-app
rm -f apps/mobile/app.json apps/mobile/package-lock.json apps/mobile/yarn.lock
pnpm install
cd apps/mobile
npx expo config --type public
npx expo-doctor
```

If `expo config` fails locally, EAS will fail the same way — fix that first.

Ensure **`.git` is at the repo root**, not inside `apps/mobile`.

## Build the test APK

```bash
cd apps/mobile
npx eas-cli whoami
npx eas-cli build --platform android --profile preview --non-interactive
```

Profile **`preview`**: internal distribution, **APK** (`android.buildType: apk`).

When the build finishes, open the URL from the CLI (or [expo.dev](https://expo.dev)) on your Android phone, scan the QR code, and install the APK.

## Production AAB (after APK works)

```bash
cd apps/mobile
npx eas-cli build --platform android --profile production --non-interactive
```

Profile **`production`**: store distribution, **AAB** (`android.buildType: app-bundle`). Requires Play / EAS Android credentials. Do not submit to Play automatically until you review the console checklist.

## Install on device

- Allow installs from the browser or file manager (“unknown apps”) if Android prompts you.
- This is **not Expo Go** — it is a native build (Health Connect, background location, camera, etc.).

## After testing

Note what works and what does not (Step 8 in `docs/CURSOR_START_HERE.md`) and feed that into your next session on the same branch.
