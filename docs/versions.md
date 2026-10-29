# Version decisions

Re-checked on 29 October 2026 (Asia/Calcutta) against npm dist-tags and [EAS infrastructure](https://docs.expo.dev/build-reference/infrastructure/).

## Selected stack (this repo)

| Decision | Exact version | Why | Official source | Compatibility |
| --- | --- | --- | --- | --- |
| Expo SDK | 57 (`expo@57.0.31`, CLI reports 57.0.32) | npm `sdk-57` dist-tag. Stable, doctor-aligned, and what this app’s native modules were validated against. | [SDK reference](https://docs.expo.dev/versions/latest/), npm `expo` dist-tags | npm `latest` is now **SDK 58** (`58.0.21`). SDK 58 is a major migration (RN 0.88 / React 19.3). Deferred until APK/AAB pipelines are green on SDK 57. |
| React Native | 0.86.3 | SDK 57 peer. | SDK 57 matrix | Do not install RN 0.87/0.88 while staying on SDK 57. |
| React | 19.2.3 | SDK 57 peer. | SDK 57 matrix | React 19.3.0 is outside this SDK. |
| Expo Router | ~57.0.29 | Aligned with installed SDK 57 packages (`expo install --check` clean). | Expo module versions | Follow SDK. |
| TypeScript | ~6.0.3 | Expo Doctor expected range for SDK 57. | [expo/expo#47627](https://github.com/expo/expo/issues/47627) | TypeScript 7 is a different compiler and is not accepted by Expo Doctor for this SDK. |
| Node.js (local / engines) | `>=22.13.0` (`.nvmrc` = `22.23.1`) | Matches Expo minimum and the SDK 57 EAS Android image Node. | Node release schedule; Expo engines | Node 18.18.0 (old EAS images) is unsupported. Node 24 Active LTS is fine locally if still `>=22.13.0`, but cloud builds pin 22.23.1. |
| pnpm | 12.6.0 | Root `packageManager` field; lockfileVersion 9. | package.json | EAS `sdk-57` image defaults to pnpm 11.9.0 — every build profile overrides to 12.6.0. |
| EAS Android image | `sdk-57` (`ubuntu-26.04-jdk-17-ndk-r27b-sdk-57`) | Forced in `eas.json` `base` so SDK detection failure cannot fall back to a Node 18 image. | [EAS infrastructure](https://docs.expo.dev/build-reference/infrastructure/) | Image Node 22.23.1, JDK 17, NDK r27b. |
| Android compile / target SDK | 36 | SDK 57 row; `minSdkVersion` 26 for Health Connect. | SDK reference | Set via `expo-build-properties`. |
| Android application ID | `app.vitacore.mobile` | From `packages/brand/brand.json` → `app.config.ts`. | brand.json | Previously rumored ID `com.shivamjjje.vitacore` is **not** in this repository. Do not change without explicit owner approval. |

## EAS profile policy

All profiles (`development`, `preview`, `production`) extend `base`, which sets:

- `node`: `22.23.1`
- `pnpm`: `12.6.0`
- Android/iOS `image`: `sdk-57`

`corepack: true` is **not** used (known conflict with EAS’s own pnpm installer when both are set).

- **preview** → internal distribution, Android `buildType: apk`
- **production** → store distribution, Android `buildType: app-bundle`

## Not selected (this pass)

- Expo SDK 58 (`latest` / stable). Prefer a controlled migration after verified APK + AAB on SDK 57.
- Node.js 26 Current line for EAS (image is Node 22.23.1).
- TypeScript 7.
- React Native versions outside the SDK 57 peers.
- Changing the Android package / application ID.

## Local verification stamp (29 Oct 2026)

| Check | Result |
| --- | --- |
| `pnpm install` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS (280) |
| `pnpm lint` | PASS |
| `npx expo-doctor` | PASS (21/21) |
| `npx expo install --check` | PASS |
| `npx expo prebuild --platform android --no-install` | PASS (generated `android/` is gitignored; removed after check) |
| `eas build` | BLOCKED (no `EXPO_TOKEN` / Expo login in this environment) |
