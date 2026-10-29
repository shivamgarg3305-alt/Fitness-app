/**
 * Manual sleep-session lifecycle against preferences + sleep_sessions.
 * Active sessions live in preferences so unfinished nights survive restart
 * without violating asleep_* NOT NULL on completed rows.
 */
import {
  applySleepTimeCorrections,
  canStartManualSleep,
  cancelManualSleep,
  deviceTimeZone,
  localDay,
  startManualSleep,
  wakeManualSleep,
  type ManualSleepSession,
} from "@vitacore/domain";
import { createId } from "@/lib/id";
import { readActiveManualSleep, saveSleep, writeActiveManualSleep } from "./logs";

export async function getActiveSleepSession(): Promise<ManualSleepSession | null> {
  return readActiveManualSleep();
}

export async function beginSleepSession(): Promise<ManualSleepSession> {
  const existing = await readActiveManualSleep();
  const allowed = canStartManualSleep(existing?.id ?? null);
  if (!allowed.ok) throw new Error(allowed.reason);
  const session = startManualSleep({
    id: createId(),
    startedAtIso: new Date().toISOString(),
    timezone: deviceTimeZone(),
  });
  await writeActiveManualSleep(session);
  return session;
}

export async function endSleepSession(endedAtIso = new Date().toISOString()): Promise<ManualSleepSession> {
  const active = await readActiveManualSleep();
  if (!active) throw new Error("No active sleep session to end.");
  const ended = wakeManualSleep(active, endedAtIso);
  if ("ok" in ended) throw new Error(ended.reason);
  const zone = ended.timezone || deviceTimeZone();
  const wakeDay = localDay(new Date(ended.sessionEndedAt ?? endedAtIso), zone);
  // Persist time-in-bed / elapsed bounds. Asleep stays unconfirmed until the user corrects it.
  await saveSleep({
    id: ended.id,
    day: wakeDay,
    timezone: zone,
    start: ended.sessionStartedAt,
    end: ended.sessionEndedAt ?? endedAtIso,
    inBedStart: ended.inBedStart,
    inBedEnd: ended.inBedEnd,
    sessionStartedAt: ended.sessionStartedAt,
    sessionEndedAt: ended.sessionEndedAt,
    asleepConfirmed: false,
  });
  await writeActiveManualSleep(null);
  return ended;
}

export async function abandonSleepSession(cancelledAtIso = new Date().toISOString()): Promise<void> {
  const active = await readActiveManualSleep();
  if (!active) return;
  const cancelled = cancelManualSleep(active, cancelledAtIso);
  if ("ok" in cancelled) throw new Error(cancelled.reason);
  await writeActiveManualSleep(null);
}

export async function correctCompletedSleep(
  session: ManualSleepSession,
  patch: Partial<Pick<ManualSleepSession, "inBedStart" | "inBedEnd" | "asleepStart" | "asleepEnd">>,
): Promise<ManualSleepSession> {
  const corrected = applySleepTimeCorrections(session, patch);
  if ("ok" in corrected) throw new Error(corrected.reason);
  if (!corrected.asleepStart || !corrected.asleepEnd) {
    throw new Error("Confirm both asleep start and end before saving a sleep duration.");
  }
  const zone = corrected.timezone || deviceTimeZone();
  const wakeDay = localDay(new Date(corrected.asleepEnd), zone);
  await saveSleep({
    id: corrected.id,
    day: wakeDay,
    timezone: zone,
    start: corrected.asleepStart,
    end: corrected.asleepEnd,
    inBedStart: corrected.inBedStart,
    inBedEnd: corrected.inBedEnd,
    sessionStartedAt: corrected.sessionStartedAt,
    sessionEndedAt: corrected.sessionEndedAt,
    asleepConfirmed: true,
  });
  return corrected;
}
