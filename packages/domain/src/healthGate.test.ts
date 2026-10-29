import { describe, expect, it } from "vitest";
import {
  REQUIRED_HEALTH_CONNECT_READ_TYPES,
  areAllHealthConnectPermissionsGranted,
  decideHealthGate,
  missingHealthConnectPermissions,
} from "./healthGate";

describe("Health Connect permission completeness", () => {
  it("reports every required type as missing when nothing is granted", () => {
    expect(missingHealthConnectPermissions([])).toEqual([...REQUIRED_HEALTH_CONNECT_READ_TYPES]);
    expect(areAllHealthConnectPermissionsGranted([])).toBe(false);
  });

  it("passes only when every required read type is present", () => {
    const partial = REQUIRED_HEALTH_CONNECT_READ_TYPES.slice(0, -1).map((recordType) => ({
      accessType: "read",
      recordType,
    }));
    expect(missingHealthConnectPermissions(partial)).toEqual(["ExerciseSession"]);
    expect(areAllHealthConnectPermissionsGranted(partial)).toBe(false);

    const full = REQUIRED_HEALTH_CONNECT_READ_TYPES.map((recordType) => ({
      accessType: "read",
      recordType,
    }));
    expect(missingHealthConnectPermissions(full)).toEqual([]);
    expect(areAllHealthConnectPermissionsGranted(full)).toBe(true);
  });

  it("ignores write grants and unrelated record types", () => {
    const granted = [
      ...REQUIRED_HEALTH_CONNECT_READ_TYPES.map((recordType) => ({ accessType: "read", recordType })),
      { accessType: "write", recordType: "Steps" },
      { accessType: "read", recordType: "Nutrition" },
    ];
    expect(areAllHealthConnectPermissionsGranted(granted)).toBe(true);
  });
});

describe("decideHealthGate", () => {
  it("requires setup on Android until all grants exist", () => {
    expect(decideHealthGate({ platform: "android", androidAllGranted: false }).action).toBe("require_health_setup");
    expect(decideHealthGate({ platform: "android", androidAllGranted: true })).toEqual({ action: "proceed" });
  });

  it("marks iOS and web as unsupported for this Android-first release", () => {
    expect(decideHealthGate({ platform: "ios", androidAllGranted: null }).action).toBe("platform_unsupported");
    expect(decideHealthGate({ platform: "web", androidAllGranted: null }).action).toBe("platform_unsupported");
  });
});
