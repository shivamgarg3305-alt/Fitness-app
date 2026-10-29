/**
 * Pure release-readiness checks. No device APIs — callers supply env and identifiers.
 * Status meanings:
 * - ok: declared and present
 * - missing: required value absent (blocks a production build or a feature)
 * - blocked: known external dependency (credentials, store forms) not available here
 * - unverified: code/config present but not proven on a physical device or live service
 */

export type ReleaseCheckStatus = "ok" | "missing" | "blocked" | "unverified";

export type ReleaseCheck = {
  id: string;
  label: string;
  status: ReleaseCheckStatus;
  detail: string;
};

export type PublicEnvSnapshot = {
  supabaseUrl?: string | null;
  supabasePublishableKey?: string | null;
  mapTileStyleUrl?: string | null;
};

export type AppIdentitySnapshot = {
  name: string;
  version: string;
  scheme: string;
  iosBundleIdentifier: string;
  androidPackage: string;
};

function present(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Public client env expected at EAS build time. Never includes secrets. */
export function evaluatePublicEnv(env: PublicEnvSnapshot): ReleaseCheck[] {
  return [
    {
      id: "supabase_url",
      label: "Supabase URL",
      status: present(env.supabaseUrl) ? "ok" : "missing",
      detail: present(env.supabaseUrl)
        ? "EXPO_PUBLIC_SUPABASE_URL is set for this build."
        : "EXPO_PUBLIC_SUPABASE_URL is empty. Auth and cloud backup stay unavailable until it is set in EAS env.",
    },
    {
      id: "supabase_publishable_key",
      label: "Supabase publishable key",
      status: present(env.supabasePublishableKey) ? "ok" : "missing",
      detail: present(env.supabasePublishableKey)
        ? "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is set for this build."
        : "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is empty. Never put a service-role key in the mobile client.",
    },
    {
      id: "map_tiles",
      label: "Map tile style",
      status: present(env.mapTileStyleUrl) ? "ok" : "unverified",
      detail: present(env.mapTileStyleUrl)
        ? "EXPO_PUBLIC_MAP_TILE_STYLE_URL is set. Tile rendering still needs a development build to verify."
        : "Optional. Empty means GPS routes draw as an outline only — that is intentional, not an error.",
    },
  ];
}

export function evaluateAppIdentity(identity: AppIdentitySnapshot): ReleaseCheck[] {
  const checks: ReleaseCheck[] = [
    {
      id: "app_name",
      label: "App name",
      status: present(identity.name) ? "ok" : "missing",
      detail: present(identity.name) ? identity.name : "Brand name is missing from packages/brand.",
    },
    {
      id: "app_version",
      label: "Version",
      status: present(identity.version) ? "ok" : "missing",
      detail: present(identity.version) ? `Version ${identity.version}` : "Version is missing.",
    },
    {
      id: "url_scheme",
      label: "URL scheme",
      status: present(identity.scheme) ? "ok" : "missing",
      detail: present(identity.scheme)
        ? `Deep-link scheme ${identity.scheme}:// (auth callback uses ${identity.scheme}://auth/callback).`
        : "URL scheme is required for OAuth redirects.",
    },
    {
      id: "ios_bundle",
      label: "iOS bundle id",
      status: present(identity.iosBundleIdentifier) ? "ok" : "missing",
      detail: present(identity.iosBundleIdentifier)
        ? identity.iosBundleIdentifier
        : "iosBundleIdentifier is missing.",
    },
    {
      id: "android_package",
      label: "Android package",
      status: present(identity.androidPackage) ? "ok" : "missing",
      detail: present(identity.androidPackage) ? identity.androidPackage : "androidPackage is missing.",
    },
  ];
  return checks;
}

/** Store / credential items that cannot be completed in this repo alone. */
export function evaluateExternalBlockers(): ReleaseCheck[] {
  return [
    {
      id: "eas_credentials",
      label: "EAS / store credentials",
      status: "blocked",
      detail: "Apple Developer, Google Play, and EAS project credentials are not in this environment. Development builds cannot be produced here.",
    },
    {
      id: "privacy_policy",
      label: "Privacy policy & store forms",
      status: "blocked",
      detail: "Privacy policy URL, Apple App Privacy labels, Android Data Safety, and Health Connect Play Console declaration are required before store submission and are not authored in this repo.",
    },
    {
      id: "device_health",
      label: "HealthKit / Health Connect on device",
      status: "unverified",
      detail: "Adapters and permissions are implemented. Reads have not been proven on a physical phone in this environment.",
    },
    {
      id: "device_gps",
      label: "Background GPS on device",
      status: "unverified",
      detail: "Foreground and background location plumbing exists. Lock-screen continuity is unverified on device.",
    },
    {
      id: "device_notifications",
      label: "Local reminders on device",
      status: "unverified",
      detail: "Channels and scheduling are implemented. Delivery has not been proven on a physical phone.",
    },
  ];
}

export function summarizeReleaseChecks(checks: ReleaseCheck[]): {
  ok: number;
  missing: number;
  blocked: number;
  unverified: number;
} {
  return checks.reduce(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { ok: 0, missing: 0, blocked: 0, unverified: 0 },
  );
}

export function buildReleaseChecklist(input: {
  env: PublicEnvSnapshot;
  identity: AppIdentitySnapshot;
}): ReleaseCheck[] {
  return [...evaluateAppIdentity(input.identity), ...evaluatePublicEnv(input.env), ...evaluateExternalBlockers()];
}

/**
 * Product feature tracker statuses from the master handover.
 * Evidence must match: "implemented" alone is never treated as device-verified.
 */
export type FeatureTrackerStatus =
  | "not_started"
  | "in_progress"
  | "implemented_not_verified"
  | "verified_in_automated_tests"
  | "verified_on_physical_device"
  | "blocked";

export type FeatureTrackerItem = {
  id: string;
  label: string;
  status: FeatureTrackerStatus;
  evidence: string;
};

/** Static audit snapshot for Milestone 6. Update evidence when verification changes. */
export function featureStatusTracker(env: PublicEnvSnapshot = {}): FeatureTrackerItem[] {
  const supabaseConfigured = present(env.supabaseUrl) && present(env.supabasePublishableKey);
  return [
    { id: "design_system", label: "Design system", status: "implemented_not_verified", evidence: "Dark Glass tokens and glass components shipped; UI not device-polished." },
    { id: "authentication", label: "Authentication", status: supabaseConfigured ? "implemented_not_verified" : "blocked", evidence: supabaseConfigured ? "Google OAuth via Supabase coded; live sign-in unverified." : "Blocked on EXPO_PUBLIC_SUPABASE_* and Google provider config." },
    { id: "onboarding", label: "Onboarding", status: "verified_in_automated_tests", evidence: "Wizard + domain validation covered by onboarding tests; interactive controls unverified on device." },
    { id: "dashboard", label: "Dashboard", status: "implemented_not_verified", evidence: "Home aggregates local + health readers with honest unavailable states." },
    { id: "workouts", label: "Workouts", status: "verified_in_automated_tests", evidence: "Session logging, PR/share/streak domain logic tested; execution UX unverified on device." },
    { id: "exercise_catalog", label: "Exercise catalog and media", status: "implemented_not_verified", evidence: "Original text cues + honest media placeholders; no licensed demo media." },
    { id: "nutrition", label: "Nutrition and barcode scanning", status: "verified_in_automated_tests", evidence: "Domain nutrition tests pass; Open Food Facts + camera need network/device." },
    { id: "hydration", label: "Hydration", status: "verified_in_automated_tests", evidence: "Local water logs and goals covered in domain/nutrition tests." },
    { id: "sleep", label: "Sleep and sleep reports", status: "verified_in_automated_tests", evidence: "Sleep score domain logic tested; platform sleep reads unverified on device." },
    { id: "smart_alarm", label: "Smart alarm", status: "not_started", evidence: "Explicitly not built. Fixed-time goal reminders are not a smart alarm." },
    { id: "recovery", label: "Recovery and heart-rate metrics", status: "verified_in_automated_tests", evidence: "Recovery scoring tested with honest missing-input behavior; HR/HRV reads unverified on device." },
    { id: "gps", label: "GPS and route history", status: "verified_in_automated_tests", evidence: "Geo/split/background domain tests pass; native watch/background unverified." },
    { id: "healthkit", label: "HealthKit", status: "implemented_not_verified", evidence: "iOS adapter + permissions declared; no physical iPhone verification here." },
    { id: "health_connect", label: "Health Connect", status: "implemented_not_verified", evidence: "Android adapter + manifest permissions; no physical Android verification here." },
    { id: "wearables", label: "Wearables", status: "blocked", evidence: "No WHOOP/Fitbit/Garmin clients. Data only via HealthKit/Health Connect if the device app already writes there." },
    {
      id: "ai_coach",
      label: "AI coach",
      status: supabaseConfigured ? "implemented_not_verified" : "blocked",
      evidence: supabaseConfigured
        ? "ai-coach Edge Function deployed with GEMINI_API_KEY. Needs a signed-in Google session on device to verify end-to-end replies."
        : "Blocked on Supabase env and Edge Function deploy + GEMINI_API_KEY.",
    },
    { id: "analytics", label: "Analytics", status: "verified_in_automated_tests", evidence: "History/progress domain series tested against local records." },
    { id: "offline", label: "Offline persistence", status: "verified_in_automated_tests", evidence: "SQLite + outbox patterns covered; browser preview durability is not production." },
    {
      id: "cloud_sync",
      label: "Cloud synchronization",
      status: supabaseConfigured ? "implemented_not_verified" : "blocked",
      evidence: supabaseConfigured
        ? "Upload/backup-only sync ready against this Supabase project after Google sign-in + local data claim. New-device restore not implemented."
        : "Blocked on Supabase public env.",
    },
    { id: "streaks_prs", label: "Streaks and personal records", status: "verified_in_automated_tests", evidence: "Retention domain tests pass." },
    { id: "workout_sharing", label: "Workout sharing", status: "implemented_not_verified", evidence: "Share summary builder tested; system share sheet unverified on device." },
    { id: "starter_programs", label: "Starter programs", status: "verified_in_automated_tests", evidence: "Ranking from onboarding profile tested." },
    { id: "local_notifications", label: "Local notifications", status: "verified_in_automated_tests", evidence: "Reminder planning tested; OS delivery unverified." },
    { id: "permissions", label: "Permissions", status: "implemented_not_verified", evidence: "Config + recovery UX shipped; prompts unverified on device." },
    { id: "security_privacy", label: "Security and privacy", status: "implemented_not_verified", evidence: "RLS policies in migrations; no committed secrets found. Live RLS proof and store privacy forms blocked." },
    { id: "android_release", label: "Android release build", status: "blocked", evidence: "EAS production profile exists; no Play/EAS credentials in this environment." },
    { id: "ios_release", label: "iOS release build", status: "blocked", evidence: "EAS production profile exists; no Apple/EAS credentials in this environment." },
    { id: "store_submission", label: "Store submission readiness", status: "blocked", evidence: "Privacy policy, App Privacy labels, Data Safety, Health Connect declaration, and signed binaries outstanding." },
  ];
}

export function summarizeFeatureTracker(items: FeatureTrackerItem[]): Record<FeatureTrackerStatus, number> {
  return items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    {
      not_started: 0,
      in_progress: 0,
      implemented_not_verified: 0,
      verified_in_automated_tests: 0,
      verified_on_physical_device: 0,
      blocked: 0,
    },
  );
}
