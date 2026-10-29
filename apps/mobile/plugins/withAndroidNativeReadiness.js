/**
 * Declares Android Health Connect package visibility + health read permissions
 * and ensures notification / activity-recognition permissions used at runtime.
 * Keep in sync with apps/mobile/src/health/native.android.ts PERMISSIONS.
 */
// Resolve through `expo` so pnpm does not need a direct @expo/config-plugins dependency.
const { createRunOncePlugin, withAndroidManifest } = require("expo/config-plugins");

const HEALTH_READ_PERMISSIONS = [
  "android.permission.health.READ_STEPS",
  "android.permission.health.READ_DISTANCE",
  "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
  "android.permission.health.READ_SLEEP",
  "android.permission.health.READ_HEART_RATE",
  "android.permission.health.READ_RESTING_HEART_RATE",
  "android.permission.health.READ_HEART_RATE_VARIABILITY",
  "android.permission.health.READ_EXERCISE",
];

const EXTRA_PERMISSIONS = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.ACTIVITY_RECOGNITION",
  ...HEALTH_READ_PERMISSIONS,
];

function ensureUsesPermission(manifest, name) {
  if (!manifest.manifest["uses-permission"]) {
    manifest.manifest["uses-permission"] = [];
  }
  const list = manifest.manifest["uses-permission"];
  const exists = list.some((entry) => entry.$?.["android:name"] === name);
  if (!exists) {
    list.push({ $: { "android:name": name } });
  }
}

function ensureHealthConnectQuery(manifest) {
  if (!manifest.manifest.queries) {
    manifest.manifest.queries = [{}];
  }
  const queries = manifest.manifest.queries[0];
  if (!queries.package) queries.package = [];
  const packageName = "com.google.android.apps.healthdata";
  const exists = queries.package.some((entry) => entry.$?.["android:name"] === packageName);
  if (!exists) {
    queries.package.push({ $: { "android:name": packageName } });
  }
}

const withAndroidNativeReadiness = (config) =>
  withAndroidManifest(config, (config) => {
    for (const name of EXTRA_PERMISSIONS) {
      ensureUsesPermission(config.modResults, name);
    }
    ensureHealthConnectQuery(config.modResults);
    return config;
  });

module.exports = createRunOncePlugin(
  withAndroidNativeReadiness,
  "vitacore-android-native-readiness",
  "1.0.0",
);

module.exports.HEALTH_READ_PERMISSIONS = HEALTH_READ_PERMISSIONS;
module.exports.EXTRA_PERMISSIONS = EXTRA_PERMISSIONS;
