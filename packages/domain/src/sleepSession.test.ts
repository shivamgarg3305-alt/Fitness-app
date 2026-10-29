import { describe, expect, it } from "vitest";
import {
  applySleepTimeCorrections,
  bedtimeConsistencyMinutes,
  cancelManualSleep,
  canStartManualSleep,
  recoverActiveSleepSession,
  selectSmartAlarmWake,
  sleepDurationBreakdown,
  startManualSleep,
  wakeManualSleep,
} from "./sleepSession";

const zone = "Asia/Kolkata";

describe("manual sleep session lifecycle", () => {
  it("starts a session and persists the start timestamp", () => {
    const session = startManualSleep({ id: "s1", startedAtIso: "2026-10-28T21:00:00.000Z", timezone: zone });
    expect(session.status).toBe("active");
    expect(session.sessionStartedAt).toBe("2026-10-28T21:00:00.000Z");
    expect(session.inBedStart).toBe("2026-10-28T21:00:00.000Z");
    expect(session.asleepStart).toBeNull();
    expect(session.asleepEnd).toBeNull();
  });

  it("prevents duplicate active sessions", () => {
    expect(canStartManualSleep("already-active")).toEqual({
      ok: false,
      reason: expect.stringContaining("already in progress"),
    });
    expect(canStartManualSleep(null)).toEqual({ ok: true });
  });

  it("wakes, records end, and keeps asleep unset until corrected", () => {
    const active = startManualSleep({ id: "s1", startedAtIso: "2026-10-28T21:00:00.000Z", timezone: zone });
    const ended = wakeManualSleep(active, "2026-10-29T05:00:00.000Z");
    expect("status" in ended && ended.status).toBe("completed");
    if ("ok" in ended) throw new Error("expected completed session");
    expect(ended.sessionEndedAt).toBe("2026-10-29T05:00:00.000Z");
    expect(ended.inBedEnd).toBe("2026-10-29T05:00:00.000Z");
    expect(ended.asleepStart).toBeNull();
    expect(ended.asleepEnd).toBeNull();
    const breakdown = sleepDurationBreakdown(ended);
    expect(breakdown.elapsedSessionMinutes).toBe(480);
    expect(breakdown.timeInBedMinutes).toBe(480);
    expect(breakdown.asleepMinutes).toBeNull();
  });

  it("cancels safely without inventing asleep duration", () => {
    const active = startManualSleep({ id: "s1", startedAtIso: "2026-10-28T21:00:00.000Z", timezone: zone });
    const cancelled = cancelManualSleep(active, "2026-10-28T21:15:00.000Z");
    if ("ok" in cancelled) throw new Error("expected cancelled session");
    expect(cancelled.status).toBe("cancelled");
    expect(sleepDurationBreakdown(cancelled).asleepMinutes).toBeNull();
  });

  it("rejects wake before start", () => {
    const active = startManualSleep({ id: "s1", startedAtIso: "2026-10-28T21:00:00.000Z", timezone: zone });
    expect(wakeManualSleep(active, "2026-10-28T20:00:00.000Z")).toEqual({
      ok: false,
      reason: expect.stringContaining("after"),
    });
  });

  it("allows correcting bedtime and wake / asleep times after completion", () => {
    const active = startManualSleep({ id: "s1", startedAtIso: "2026-10-28T21:00:00.000Z", timezone: zone });
    const ended = wakeManualSleep(active, "2026-10-29T05:00:00.000Z");
    if ("ok" in ended) throw new Error("expected completed");
    const corrected = applySleepTimeCorrections(ended, {
      inBedStart: "2026-10-28T21:30:00.000Z",
      inBedEnd: "2026-10-29T05:00:00.000Z",
      asleepStart: "2026-10-28T22:00:00.000Z",
      asleepEnd: "2026-10-29T04:45:00.000Z",
    });
    if ("ok" in corrected) throw new Error("expected corrected");
    const breakdown = sleepDurationBreakdown(corrected);
    expect(breakdown.timeInBedMinutes).toBe(450);
    expect(breakdown.asleepMinutes).toBe(405);
    expect(breakdown.elapsedSessionMinutes).toBe(480);
  });

  it("rejects corrections while active", () => {
    const active = startManualSleep({ id: "s1", startedAtIso: "2026-10-28T21:00:00.000Z", timezone: zone });
    expect(applySleepTimeCorrections(active, { asleepStart: "2026-10-28T22:00:00.000Z" })).toMatchObject({
      ok: false,
    });
  });

  it("recovers an unfinished active session after restart", () => {
    const active = startManualSleep({ id: "s1", startedAtIso: "2026-10-28T21:00:00.000Z", timezone: zone });
    expect(recoverActiveSleepSession(active)?.id).toBe("s1");
    expect(recoverActiveSleepSession({ ...active, status: "completed" })).toBeNull();
    expect(recoverActiveSleepSession(null)).toBeNull();
    expect(recoverActiveSleepSession({ ...active, sessionStartedAt: "not-a-date" })).toBeNull();
  });

  it("distinguishes elapsed, in-bed, and asleep while active using now", () => {
    const active = startManualSleep({ id: "s1", startedAtIso: "2026-10-28T21:00:00.000Z", timezone: zone });
    const breakdown = sleepDurationBreakdown(active, "2026-10-28T22:30:00.000Z");
    expect(breakdown.elapsedSessionMinutes).toBe(90);
    expect(breakdown.timeInBedMinutes).toBeNull();
    expect(breakdown.asleepMinutes).toBeNull();
  });
});

describe("smart alarm window selection", () => {
  it("falls back to target when no stage samples exist", () => {
    const result = selectSmartAlarmWake({
      targetWakeIso: "2026-10-29T07:00:00.000Z",
      windowMinutes: 30,
      nowIso: "2026-10-29T06:40:00.000Z",
    });
    expect(result).toEqual({
      status: "fallback",
      wakeIso: "2026-10-29T07:00:00.000Z",
      reason: expect.stringContaining("Falling back"),
    });
  });

  it("selects a fresh light sample inside the window", () => {
    const result = selectSmartAlarmWake({
      targetWakeIso: "2026-10-29T07:00:00.000Z",
      windowMinutes: 30,
      nowIso: "2026-10-29T06:50:00.000Z",
      stageSamples: [
        { atIso: "2026-10-29T06:45:00.000Z", kind: "light" },
        { atIso: "2026-10-29T06:20:00.000Z", kind: "deep" },
      ],
    });
    expect(result.status).toBe("smart");
    expect(result.wakeIso).toBe("2026-10-29T06:45:00.000Z");
  });

  it("ignores stale samples and falls back", () => {
    const result = selectSmartAlarmWake({
      targetWakeIso: "2026-10-29T07:00:00.000Z",
      windowMinutes: 45,
      maxSampleAgeMinutes: 10,
      nowIso: "2026-10-29T06:55:00.000Z",
      stageSamples: [{ atIso: "2026-10-29T06:30:00.000Z", kind: "light" }],
    });
    expect(result.status).toBe("fallback");
  });

  it("only accepts 15/30/45 windows at the type level via SMART_ALARM_WINDOWS usage in callers", () => {
    expect(selectSmartAlarmWake({
      targetWakeIso: "2026-10-29T07:00:00.000Z",
      windowMinutes: 15,
      nowIso: "2026-10-29T06:50:00.000Z",
    }).status).toBe("fallback");
  });
});

describe("bedtime consistency", () => {
  it("returns null with fewer than 3 nights", () => {
    expect(bedtimeConsistencyMinutes({ bedtimeMinutes: [1380, 1390] })).toBeNull();
  });

  it("computes mean absolute deviation", () => {
    expect(bedtimeConsistencyMinutes({ bedtimeMinutes: [1380, 1390, 1370] })).toBe(7);
  });
});
