import { describe, expect, it } from "vitest";
import {
  buildReleaseChecklist,
  evaluateAppIdentity,
  evaluatePublicEnv,
  featureStatusTracker,
  summarizeFeatureTracker,
  summarizeReleaseChecks,
} from "./release";

describe("evaluatePublicEnv", () => {
  it("marks required Supabase values missing when empty", () => {
    const checks = evaluatePublicEnv({});
    expect(checks.find((item) => item.id === "supabase_url")?.status).toBe("missing");
    expect(checks.find((item) => item.id === "supabase_publishable_key")?.status).toBe("missing");
    expect(checks.find((item) => item.id === "map_tiles")?.status).toBe("unverified");
  });

  it("marks present values ok", () => {
    const checks = evaluatePublicEnv({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "pub_test",
      mapTileStyleUrl: "https://tiles.example/style.json",
    });
    expect(checks.every((item) => item.status === "ok")).toBe(true);
  });
});

describe("evaluateAppIdentity", () => {
  it("accepts the brand snapshot", () => {
    const checks = evaluateAppIdentity({
      name: "VitaCore",
      version: "0.1.0",
      scheme: "vitacore",
      iosBundleIdentifier: "app.vitacore.mobile",
      androidPackage: "app.vitacore.mobile",
    });
    expect(summarizeReleaseChecks(checks)).toEqual({ ok: 5, missing: 0, blocked: 0, unverified: 0 });
  });
});

describe("buildReleaseChecklist", () => {
  it("includes external blockers that stay blocked without credentials", () => {
    const checks = buildReleaseChecklist({
      env: { supabaseUrl: "https://example.supabase.co", supabasePublishableKey: "pub" },
      identity: {
        name: "VitaCore",
        version: "0.1.0",
        scheme: "vitacore",
        iosBundleIdentifier: "app.vitacore.mobile",
        androidPackage: "app.vitacore.mobile",
      },
    });
    expect(checks.some((item) => item.id === "eas_credentials" && item.status === "blocked")).toBe(true);
    expect(checks.some((item) => item.id === "device_gps" && item.status === "unverified")).toBe(true);
  });
});

describe("featureStatusTracker", () => {
  it("never marks physical-device verification without evidence", () => {
    const items = featureStatusTracker({});
    expect(items.every((item) => item.status !== "verified_on_physical_device")).toBe(true);
    expect(items.find((item) => item.id === "smart_alarm")?.status).toBe("not_started");
    expect(items.find((item) => item.id === "cloud_sync")?.status).toBe("blocked");
  });

  it("marks auth blocked until Supabase public env is present", () => {
    const empty = summarizeFeatureTracker(featureStatusTracker({}));
    expect(empty.blocked).toBeGreaterThan(0);
    expect(featureStatusTracker({}).find((item) => item.id === "cloud_sync")?.status).toBe("blocked");
    const configured = featureStatusTracker({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "pub",
    });
    expect(configured.find((item) => item.id === "authentication")?.status).toBe("implemented_not_verified");
    expect(configured.find((item) => item.id === "cloud_sync")?.status).toBe("implemented_not_verified");
    expect(configured.find((item) => item.id === "ai_coach")?.status).toBe("implemented_not_verified");
  });
});
