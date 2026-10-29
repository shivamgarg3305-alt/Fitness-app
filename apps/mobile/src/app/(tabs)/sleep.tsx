import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  bedtimeConsistencyMinutes,
  deviceTimeZone,
  formatDuration,
  historyRanges,
  localDay,
  overnightSleepBounds,
  scoreSleep,
  seriesForRange,
  sleepDurationBreakdown,
  startOfZonedDay,
  type ManualSleepSession,
} from "@vitacore/domain";
import { HistoryBars } from "@/components/history-bars";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ProgressRing,
  Screen,
  Slider,
  TextField,
  WeekStrip,
} from "@/components/ui";
import { useAppState } from "@/data/app-state";
import {
  deleteSleep,
  listSleepSessions,
  loadLocalHistory,
  saveSleep,
  sleepForDay,
  type SleepSessionRow,
} from "@/data/logs";
import {
  abandonSleepSession,
  beginSleepSession,
  correctCompletedSleep,
  endSleepSession,
  getActiveSleepSession,
} from "@/data/sleep-session";
import { readSleep, type SleepReading } from "@/health";
import { copy } from "@/i18n/copy";
import { useTheme } from "@/design/theme";
import { space } from "@/design/tokens";

function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}

function isoToClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function correctedBounds(day: string, bedClock: string, wakeClock: string, zone: string) {
  return overnightSleepBounds({
    wakeDay: day,
    bedTime: bedClock,
    wakeTime: wakeClock,
    timeZone: zone,
  });
}

function SlideToWake({ onWake, disabled }: { onWake: () => void; disabled?: boolean }) {
  const [value, setValue] = useState(0);
  return (
    <View accessibilityHint="Slide all the way right to wake, or use the Wake up button below.">
      <Slider
        label="Slide to wake up"
        value={value}
        onChange={(next) => {
          if (disabled) return;
          setValue(next);
          if (next >= 1) {
            setValue(0);
            onWake();
          }
        }}
      />
    </View>
  );
}

export default function SleepScreen() {
  const router = useRouter();
  const { profile } = useAppState();
  const { colors } = useTheme();
  const zone = deviceTimeZone();
  const today = localDay(new Date(), zone);
  const [selected, setSelected] = useState(today);
  const [bed, setBed] = useState("23:00");
  const [wake, setWake] = useState("07:00");
  const [platformSleep, setPlatformSleep] = useState<SleepReading | null>(null);
  const [manual, setManual] = useState<Awaited<ReturnType<typeof sleepForDay>>>(null);
  const [historyRows, setHistoryRows] = useState<SleepSessionRow[]>([]);
  const [sleepHistory, setSleepHistory] = useState<Awaited<ReturnType<typeof loadLocalHistory>>["sleepMinutes"]>([]);
  const [active, setActive] = useState<ManualSleepSession | null>(null);
  const [elapsedLabel, setElapsedLabel] = useState("0m");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [correctBed, setCorrectBed] = useState("");
  const [correctWake, setCorrectWake] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);

  const refresh = useCallback(
    (day: string) => {
      const isToday = day === today;
      void (isToday ? readSleep() : Promise.resolve(null)).then(setPlatformSleep);
      void sleepForDay(day).then(setManual);
      void loadLocalHistory(zone).then((history) => setSleepHistory(history.sleepMinutes));
      void listSleepSessions(14).then(setHistoryRows);
      void getActiveSleepSession().then(setActive);
    },
    [today, zone],
  );

  useFocusEffect(
    useCallback(() => {
      refresh(selected);
    }, [refresh, selected]),
  );

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduceMotion(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const minutes = sleepDurationBreakdown(active, new Date().toISOString()).elapsedSessionMinutes ?? 0;
      setElapsedLabel(formatDuration(minutes));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [active]);

  const platformValid = selected === today && platformSleep?.status === "value";
  const confirmedManualAsleep =
    manual && manual.asleep_confirmed === 1
      ? minutesBetween(manual.asleep_start, manual.asleep_end)
      : null;
  const asleepMinutes = platformValid ? platformSleep.asleepMinutes : confirmedManualAsleep;
  const inBedMinutes = platformValid
    ? platformSleep.inBedMinutes
    : manual?.in_bed_start && manual?.in_bed_end
      ? minutesBetween(manual.in_bed_start, manual.in_bed_end)
      : null;

  const bedtimeMinutes = historyRows
    .slice(0, 7)
    .map((row) => {
      const start = row.in_bed_start ?? (row.asleep_confirmed === 1 ? row.asleep_start : null);
      if (!start) return null;
      const date = new Date(start);
      return date.getHours() * 60 + date.getMinutes();
    });
  const consistency = bedtimeConsistencyMinutes({ bedtimeMinutes });

  const score = scoreSleep({
    asleepMinutes,
    inBedMinutes,
    targetMinutes: profile?.sleepTargetMinutes ?? null,
    bedtimeDeviationMinutes: consistency,
    disturbanceCount: platformValid && platformSleep.stages ? Math.round(platformSleep.stages.awake / 15) : null,
    stageMinutes: platformValid ? platformSleep.stages : null,
  });

  async function startSleep() {
    setBusy(true);
    setSaveError(null);
    try {
      const session = await beginSleepSession();
      setActive(session);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not start sleep.");
    } finally {
      setBusy(false);
    }
  }

  async function wakeUp() {
    setBusy(true);
    setSaveError(null);
    try {
      await endSleepSession();
      setActive(null);
      refresh(selected);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not end sleep.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelActive() {
    setBusy(true);
    setSaveError(null);
    try {
      await abandonSleepSession();
      setActive(null);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not cancel.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    const bounds = overnightSleepBounds({
      wakeDay: selected,
      bedTime: bed,
      wakeTime: wake,
      timeZone: zone,
    });
    if (!bounds.ok) {
      setSaveError(bounds.reason);
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      await saveSleep({
        day: bounds.day,
        timezone: zone,
        start: bounds.startIso,
        end: bounds.endIso,
        inBedStart: bounds.startIso,
        inBedEnd: bounds.endIso,
        asleepConfirmed: true,
      });
      setManual(await sleepForDay(selected));
      refresh(selected);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "This sleep note could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCorrections() {
    if (!manual) return;
    const bounds = correctedBounds(
      manual.day,
      correctBed || isoToClock(manual.asleep_start),
      correctWake || isoToClock(manual.asleep_end),
      zone,
    );
    if (!bounds.ok) {
      setSaveError(bounds.reason);
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      const session: ManualSleepSession = {
        id: manual.id,
        status: "completed",
        sessionStartedAt: manual.session_started_at ?? manual.asleep_start,
        sessionEndedAt: manual.session_ended_at ?? manual.asleep_end,
        inBedStart: manual.in_bed_start,
        inBedEnd: manual.in_bed_end,
        asleepStart: manual.asleep_start,
        asleepEnd: manual.asleep_end,
        timezone: manual.timezone,
        source: "manual",
      };
      await correctCompletedSleep(session, {
        asleepStart: bounds.startIso,
        asleepEnd: bounds.endIso,
        inBedStart: bounds.startIso,
        inBedEnd: bounds.endIso,
      });
      refresh(selected);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not save corrections.");
    } finally {
      setBusy(false);
    }
  }

  const selectedWeekday = startOfZonedDay(selected, zone).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: zone,
  });

  if (active) {
    return (
      <Screen>
        <AppText variant="h1">Sleeping</AppText>
        <AppText variant="caption">Session started {new Date(active.sessionStartedAt).toLocaleString()}</AppText>
        <View style={{ height: space.xl }} />
        <ProgressRing progress={null} label={elapsedLabel} caption="Elapsed session" />
        <View style={{ height: space.md }} />
        <AppText variant="small" color={colors.textSecondary}>
          Elapsed session time is not the same as time asleep. Stages are not estimated from this timer.
        </AppText>
        <View style={{ height: space.xl }} />
        {!reduceMotion ? <SlideToWake onWake={() => void wakeUp()} disabled={busy} /> : null}
        <View style={{ height: space.md }} />
        <Button label={busy ? "Saving…" : "Wake up"} onPress={() => void wakeUp()} disabled={busy} />
        <View style={{ height: space.sm }} />
        <Button label="Cancel session" tone="ghost" onPress={() => void cancelActive()} disabled={busy} />
        {saveError ? (
          <>
            <View style={{ height: space.md }} />
            <AppText variant="small" color={colors.accent}>{saveError}</AppText>
          </>
        ) : null}
        <View style={{ height: space.lg }} />
        <AppText variant="caption">{copy.stagesNeedSource}</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="h1">{selectedWeekday}</AppText>
      <AppText variant="caption">{selected}</AppText>
      <View style={{ height: space.md }} />
      <WeekStrip
        days={Array.from({ length: 7 }, (_, index) => {
          const date = new Date();
          date.setDate(date.getDate() - 6 + index);
          const key = localDay(date, zone);
          return { key, label: date.toLocaleDateString("en-US", { weekday: "narrow", timeZone: zone }), selected: key === selected };
        })}
        onSelect={(key) => {
          setSelected(key);
          setSaveError(null);
          refresh(key);
        }}
      />
      <View style={{ height: space.md }} />
      <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
        <Button label="Start Sleep" onPress={() => void startSleep()} disabled={busy} />
        <Button label="Smart alarm" tone="secondary" onPress={() => router.push("/sleep-alarm" as Parameters<typeof router.push>[0])} />
        <Button label="Sleep sounds" tone="ghost" onPress={() => router.push("/sounds")} />
      </View>
      <View style={{ height: space.lg }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
        <ProgressRing
          progress={score.status === "scored" ? score.score / 100 : null}
          label={score.status === "scored" ? String(score.score) : "—"}
          caption="Score"
        />
        <View style={{ flex: 1 }}>
          <AppText variant="metric" style={{ fontSize: 40, lineHeight: 44 }}>
            {asleepMinutes == null ? "—" : formatDuration(asleepMinutes)}
          </AppText>
          <AppText variant="caption">
            {platformValid
              ? platformSleep.sourceLabel
              : manual?.asleep_confirmed === 1
                ? "Confirmed asleep (entered by you)"
                : manual
                  ? "Session / time in bed — asleep not confirmed"
                  : "No sleep record"}
          </AppText>
          {inBedMinutes != null ? (
            <AppText variant="caption">Time in bed {formatDuration(inBedMinutes)}</AppText>
          ) : null}
          {profile?.sleepTargetMinutes ? (
            <AppText variant="caption">
              Goal {formatDuration(profile.sleepTargetMinutes)}
              {asleepMinutes != null
                ? ` · ${Math.min(100, Math.round((asleepMinutes / profile.sleepTargetMinutes) * 100))}% of target`
                : ""}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={{ height: space.lg }} />
      <Card>
        <AppText variant="label">Stages & factors</AppText>
        <AppText variant="small" color={colors.textSecondary}>{copy.stagesNeedSource}</AppText>
        {platformValid && platformSleep.stages ? (
          <AppText variant="small">
            Awake {formatDuration(platformSleep.stages.awake)} · Light {formatDuration(platformSleep.stages.light)} · REM{" "}
            {formatDuration(platformSleep.stages.rem)} · Deep {formatDuration(platformSleep.stages.deep)}
          </AppText>
        ) : (
          <AppText variant="caption">No wearable/platform stages for this view.</AppText>
        )}
        {consistency != null ? (
          <AppText variant="caption">Bedtime consistency MAD ±{consistency} min (needs 3+ nights).</AppText>
        ) : (
          <AppText variant="caption">Consistency needs at least three saved bedtimes.</AppText>
        )}
        {score.status === "scored" ? (
          score.factors.map((factor) => (
            <AppText key={factor.id} variant="caption">
              {factor.id} {factor.score} · {Math.round(factor.weight * 100)}%. {factor.detail}
            </AppText>
          ))
        ) : (
          <AppText variant="caption">Score unavailable until a confirmed asleep duration and enough inputs exist.</AppText>
        )}
        {score.status === "scored" && score.omitted.length > 0 ? (
          <AppText variant="caption">Left out: {score.omitted.join(", ")}.</AppText>
        ) : null}
      </Card>
      <View style={{ height: space.lg }} />
      <Card>
        <AppText variant="label">History</AppText>
        <View style={{ height: space.sm }} />
        <HistoryBars
          points={seriesForRange(today, sleepHistory, historyRanges[0].days, historyRanges[0].bucketDays)}
          accessibilityLabel="Sleep notes for the last 7 days"
          empty="No sleep notes in the last 7 days."
        />
        {historyRows.length === 0 ? (
          <EmptyState title="No sessions yet" body="Start Sleep or enter a note below. Nothing is simulated." />
        ) : (
          historyRows.slice(0, 8).map((row) => {
            const mins =
              row.asleep_confirmed === 1 ? minutesBetween(row.asleep_start, row.asleep_end) : null;
            return (
              <View key={row.id} style={{ marginTop: space.sm, gap: 4 }}>
                <AppText variant="small">
                  {row.day} · {row.asleep_confirmed === 1 ? formatDuration(mins ?? 0) : "unconfirmed"} · {row.source}
                </AppText>
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <Button
                    label="Edit day"
                    tone="ghost"
                    onPress={() => {
                      setSelected(row.day);
                      setCorrectBed(isoToClock(row.asleep_start));
                      setCorrectWake(isoToClock(row.asleep_end));
                      setManual(row);
                    }}
                  />
                  <Button
                    label="Delete"
                    tone="ghost"
                    onPress={() => {
                      void deleteSleep(row.id).then(() => refresh(selected));
                    }}
                  />
                </View>
              </View>
            );
          })
        )}
      </Card>
      <View style={{ height: space.lg }} />
      <AppText variant="h3">{selected === today ? "Enter last night" : `Enter sleep for ${selected}`}</AppText>
      <AppText variant="caption">
        This is your note, not a sensor reading. Confirmed asleep times feed the score; Start Sleep alone only records a session.
      </AppText>
      <View style={{ height: space.sm }} />
      <TextField label="Fell asleep" value={bed} onChangeText={setBed} />
      <View style={{ height: space.sm }} />
      <TextField label="Woke" value={wake} onChangeText={setWake} />
      <View style={{ height: space.md }} />
      {saveError ? <AppText variant="small" color={colors.accent}>{saveError}</AppText> : null}
      <Button label={busy ? "Saving…" : "Save sleep note"} onPress={() => void saveNote()} disabled={busy} />
      {manual ? (
        <>
          <View style={{ height: space.lg }} />
          <AppText variant="h3">Correct times</AppText>
          <TextField label="Asleep from (HH:MM)" value={correctBed || isoToClock(manual.asleep_start)} onChangeText={setCorrectBed} />
          <View style={{ height: space.sm }} />
          <TextField label="Asleep until (HH:MM)" value={correctWake || isoToClock(manual.asleep_end)} onChangeText={setCorrectWake} />
          <View style={{ height: space.sm }} />
          <Button label="Save corrections" tone="secondary" onPress={() => void saveCorrections()} disabled={busy} />
        </>
      ) : null}
      <View style={{ height: space.lg }} />
      <Button label="Reminders & sleep alerts" tone="secondary" onPress={() => router.push("/reminders")} />
      <View style={{ height: space.sm }} />
      <Button label="Ask the coach" tone="ghost" onPress={() => router.push("/coach")} />
      <View style={{ height: space.lg }} />
      <AppText variant="caption">{copy.soundModel}</AppText>
      <AppText variant="caption">{copy.alarmLimit}</AppText>
      <AppText variant="caption">{copy.wearableBridge}</AppText>
    </Screen>
  );
}
