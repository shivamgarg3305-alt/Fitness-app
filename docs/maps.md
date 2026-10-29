# Route maps

Status: route display and MapLibre wiring are implemented in code. The default OpenFreeMap style is now configured in the component, so a provider URL is not required just to try tiles. The native module still requires a fresh development/preview build and physical-device testing.

## What is drawn

- **Route outline** (always available). Drawn with `react-native-svg` from the points stored in `activity_points`. No network, no account, no configuration. Works in the browser preview. It has no roads or labels.
- **Base map** (iOS and Android only). MapLibre draws tiles from a style URL with the route line on top. While tiles load, fail, or the phone is offline, the outline stays visible and a note says why.

## Provider choice

MapLibre, through `@maplibre/maplibre-react-native`, is used on both phones. The app now defaults to OpenFreeMap's public Liberty style:

`https://tiles.openfreemap.org/styles/liberty`

OpenFreeMap's quick-start documents this as a MapLibre style URL: https://openfreemap.org/quick_start/. This is a no-key starting configuration, not a service-level guarantee. Before a public launch, check the provider's current fair-use terms and expected traffic; switch to a provider/plan appropriate for production if needed. The user can override the default through `EXPO_PUBLIC_MAP_TILE_STYLE_URL`.

## Configuration

| Item | Value |
| --- | --- |
| `EXPO_PUBLIC_MAP_TILE_STYLE_URL` | Optional HTTPS MapLibre style URL override. If empty, the app uses the default OpenFreeMap Liberty style. |
| Default style | `https://tiles.openfreemap.org/styles/liberty` |
| Dependency | `@maplibre/maplibre-react-native` **11.4.0**. Repo uses Expo SDK 57 and React Native 0.86.3. |
| Expo config plugin | `@maplibre/maplibre-react-native` is in `app.config.ts`. |
| Expo Go | Not supported. It is a native module. |
| Native build | Required; rebuild after installing/changing native map dependencies or plugin configuration. |
| Web preview | Outline only. |

`src/components/route-map/TileMap.tsx` calls the MapLibre v11 API (`Map`, `Camera`, `GeoJSONSource`, `Layer`). The module is loaded with `require` inside try/catch, so a failed JavaScript load keeps the SVG outline. The native module and style still must be tested in a rebuilt app.

## Behavior

- **Live recording.** The record screen passes its existing points state to `RouteMap`. No second GPS source is used: the current-position dot is the newest stored route point. The map itself does not request location permission or record points. Pausing stops both foreground and background GPS updates to reduce battery use; resuming checks foreground permission and reattaches the foreground watcher.
- **Duplicates and bad coordinates.** Consecutive duplicates, missing/non-finite/out-of-range coordinates, and (0,0) are skipped for drawing only. Stored rows are not changed.
- **Long routes.** Display is simplified to at most 600 vertices; SQLite retains all recorded points.
- **Completed routes.** The activity detail screen reads the session and points from SQLite and initializes the MapLibre camera to fit the whole route. History has a View route action.
- **Empty route.** A short message; no crash and no invented route.
- **Permission denied / GPS unavailable.** The record screen handles the permission path and the map waits for a real GPS point.
- **Tile load failure/offline.** After an error or 12 seconds without a loaded style, the outline stays and a note says tiles could not load. The saved route is unaffected.

## Privacy

- Route geometry is drawn on the device and is not sent to the tile provider by this component.
- The tile host sees tile requests for the visible area and the device IP address. Select a provider whose terms and privacy posture fit the app.
- No coordinates are logged by the map component. Location data may separately sync to the user's own Supabase project through the app's sync worker.

## Verified and unverified

Executed previously: 17 route-domain logic checks under a small stand-in for Vitest (not the real pnpm/Vitest command).

Not yet run: full pnpm tests/typecheck/lint, Metro bundling, MapLibre rendering, physical-device route recording, saved-route fit, offline fallback, and background GPS behavior.

Needs an Android device/build: tiles rendering, line drawing over tiles, camera follow, saved-route view, and route recording while the screen is locked. The map provider default is configured, but this is not yet proof the map works in a released binary.
