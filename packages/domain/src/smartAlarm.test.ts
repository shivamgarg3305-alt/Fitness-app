import { describe, expect, it } from "vitest";
import {
  defaultSmartAlarmSettings,
  nextSmartAlarmWake,
  parseSmartAlarmSettings,
  planSmartAlarmNotifications,
  planTestAlarm,
  serializeSmartAlarmSettings,
  validateSmartAlarmSettings,
  type SmartAlarmSettings,
} from "./smartAlarm";
import type { Weekday } from "./reminders";

function alarm(patch: Partial<SmartAlarmSettings>): SmartAlarmSettings {
  return { ...defaultSmartAlarmSettings(), ...patch };
}

const monday6am = new Date(2026, 8, 28, 6, 0, 0, 0);

describe("smart alarm settings", () => {
  it("defaults to disabled", () => {
    expect(defaultSmartAlarmSettings().enabled).toBe(false);
  });

  it("round-trips serialization", () => {
    const settings = { ...defaultSmartAlarmSettings(), enabled: true, windowMinutes: 45 as const };
    expect(parseSmartAlarmSettings(serializeSmartAlarmSettings(settings))).toEqual(settings);
  });

  it("falls back on corrupt JSON", () => {
    expect(parseSmartAlarmSettings("{not-json")).toEqual(defaultSmartAlarmSettings());
  });

  it("requires at least one day when enabled", () => {
    const settings = { ...defaultSmartAlarmSettings(), enabled: true, days: [] };
    expect(validateSmartAlarmSettings(settings).some((e) => e.field === "days")).toBe(true);
  });
});

describe("nextSmartAlarmWake", () => {
  it("reports disabled", () => {
    expect(nextSmartAlarmWake(defaultSmartAlarmSettings(), monday6am).status).toBe("disabled");
  });

  it("falls back to target wake when no fresh stages", () => {
    const settings = alarm({
      enabled: true,
      targetWakeMinutes: 7 * 60,
      days: [1 as Weekday],
      windowMinutes: 30,
    });
    // monday6am is Monday 06:00 — next wake is today 07:00
    const next = nextSmartAlarmWake(settings, monday6am);
    expect(next.status).toBe("scheduled");
    if (next.status !== "scheduled") return;
    expect(next.selection).toBe("fallback");
    expect(next.at.getHours()).toBe(7);
    expect(next.at.getMinutes()).toBe(0);
  });

  it("can select an earlier smart wake inside the window with a fresh light sample", () => {
    const settings = alarm({
      enabled: true,
      targetWakeMinutes: 7 * 60,
      days: [1 as Weekday],
      windowMinutes: 30,
    });
    const now = new Date(2026, 8, 28, 6, 50, 0, 0);
    const target = new Date(2026, 8, 28, 7, 0, 0, 0);
    const next = nextSmartAlarmWake(settings, now, [
      { atIso: new Date(2026, 8, 28, 6, 52, 0, 0).toISOString(), kind: "light" },
    ]);
    expect(next.status).toBe("scheduled");
    if (next.status !== "scheduled") return;
    expect(next.selection).toBe("smart");
    expect(next.at.getTime()).toBeLessThan(target.getTime());
  });
});

describe("planSmartAlarmNotifications", () => {
  it("plans nothing when disabled", () => {
    expect(planSmartAlarmNotifications(defaultSmartAlarmSettings(), monday6am)).toEqual([]);
  });

  it("plans a wake notification and never suppresses it for quiet hours", () => {
    const settings = alarm({
      enabled: true,
      targetWakeMinutes: 7 * 60,
      days: [1 as Weekday],
      bedtimeReminderOffsetMinutes: null,
      windDownOffsetMinutes: null,
    });
    const planned = planSmartAlarmNotifications(settings, monday6am, {
      isQuietMinute: () => true,
    });
    expect(planned.some((item) => item.kind === "wake_alarm")).toBe(true);
  });

  it("skips bedtime reminders inside quiet hours when configured", () => {
    const settings = alarm({
      enabled: true,
      targetWakeMinutes: 7 * 60,
      days: [1 as Weekday],
      usualBedtimeMinutes: 22 * 60,
      bedtimeReminderOffsetMinutes: 30,
      windDownOffsetMinutes: null,
      remindersRespectQuietHours: true,
    });
    const planned = planSmartAlarmNotifications(settings, monday6am, {
      isQuietMinute: () => true,
    });
    expect(planned.every((item) => item.kind !== "bedtime_reminder")).toBe(true);
  });

  it("builds a test alarm a few seconds out", () => {
    const test = planTestAlarm(monday6am, defaultSmartAlarmSettings(), 5);
    expect(test.kind).toBe("test_alarm");
    expect(test.at.getTime()).toBe(monday6am.getTime() + 5000);
  });
});
