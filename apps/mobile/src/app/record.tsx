import { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import {
  buildSplits,
  deviceTimeZone,
  elevationGainMeters,
  estimatedActivityKcal,
  formatClockDuration,
  formatDistance,
  formatPace,
  mergeGeoPoints,
  movingSeconds as computeMovingSeconds,
  paceSecondsPerKilometer,
  shouldAcceptLocationUpdate,
  shouldAutoPauseForegroundRecording,
  trackDistanceMeters,
  type GeoPoint,
} from "@vitacore/domain";
import { AppText, Button, ErrorState, Screen } from "@/components/ui";
import { useAppState } from "@/data/app-state";
import {
  activityPointsForSession,
  activitySessionInfo,
  appendActivityPoint,
  beginActivitySession,
  finishActivitySession,
  getActiveActivitySession,
  setActiveActivitySession,
} from "@/data/logs";
import {
  isBackgroundLocationRunning,
  setForegroundWriterActive,
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from "@/activity/backgroundLocation";
import { RouteMap } from "@/components/route-map/RouteMap";
import { copy } from "@/i18n/copy";
import { capabilities } from "@/platform/capabilities";
import { openAppSettings } from "@/platform/system-settings";
import { space } from "@/design/tokens";
import { useTheme } from "@/design/theme";

type Kind = "walk" | "run" | "cycle" | "hike";

function routeKind(value: string | string[] | undefined): Kind {
  const kind = Array.isArray(value) ? value[0] : value;
  if (kind === "walk" || kind === "run" || kind === "cycle" || kind === "hike") return kind;
  return "walk";
}

export default function RecordScreen() {
  const { profile } = useAppState();
  const { colors } = useTheme();
  const units = profile?.unitSystem ?? "metric";
  const params = useLocalSearchParams<{ kind?: string | string[] }>();
  const [picked, setPicked] = useState<Kind | null>(null);
  const kind = picked ?? routeKind(params.kind);
  const [status, setStatus] = useState<"idle" | "recording" | "paused" | "saved">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [resumeReady, setResumeReady] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [starting, setStarting] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const started = useRef<string | null>(null);
  const watch = useRef<Location.LocationSubscription | null>(null);
  const paused = useRef(false);
  const sessionId = useRef<string | null>(null);
  const stopping = useRef(false);
  const backgroundEnabledRef = useRef(false);

  function updateBackgroundEnabled(enabled: boolean) {
    backgroundEnabledRef.current = enabled;
    setBackgroundEnabled(enabled);
  }

  function attachForegroundWatcher() {
    watch.current?.remove();
    watch.current = null;
    setForegroundWriterActive(AppState.currentState === "active");
    return Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
      (position) => {
        // The foreground watcher is the only writer while the app is visible; the background task covers the rest.
        if (AppState.currentState !== "active") return;
        if (!shouldAcceptLocationUpdate({ hasActiveSession: sessionId.current != null, paused: paused.current })) return;
        const point: GeoPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitudeMeters: position.coords.altitude,
          recordedAtMs: position.timestamp,
        };
        setPoints((current) => [...current, point]);
        if (sessionId.current) {
          void appendActivityPoint(sessionId.current, point).catch(() =>
            setMessage("A location point could not be saved on this device."),
          );
        }
      },
    ).then((subscription) => {
      watch.current = subscription;
    });
  }

  async function reloadFromDevice() {
    if (!sessionId.current) return;
    const stored = await activityPointsForSession(sessionId.current);
    setPoints((current) => mergeGeoPoints(current, stored));
  }

  // Foreground/background transitions: hand writing to the background task when the app
  // leaves the foreground, and pull in whatever it recorded when the app returns.
  // Leaving this screen without active background tracking auto-pauses so points are not
  // silently dropped; with Always/background tracking the native task continues.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (!sessionId.current) return;
      setForegroundWriterActive(next === "active");
      if (next === "active") {
        void reloadFromDevice();
        return;
      }
      if (
        shouldAutoPauseForegroundRecording({
          hasActiveSession: sessionId.current != null,
          alreadyPaused: paused.current,
          backgroundTrackingActive: backgroundEnabledRef.current,
          stopping: stopping.current,
        })
      ) {
        paused.current = true;
        setStatus("paused");
        void setActiveActivitySession({ id: sessionId.current, paused: true });
        setMessage(
          "Recording paused because VitaCore left the foreground and Always location is off. Resume on this screen, or grant Always location for lock-screen tracking.",
        );
      }
    });
    return () => {
      subscription.remove();
      setForegroundWriterActive(false);
      watch.current?.remove();
      watch.current = null;
      const id = sessionId.current;
      if (
        id &&
        shouldAutoPauseForegroundRecording({
          hasActiveSession: true,
          alreadyPaused: paused.current,
          backgroundTrackingActive: backgroundEnabledRef.current,
          stopping: stopping.current,
        })
      ) {
        paused.current = true;
        void setActiveActivitySession({ id, paused: true });
      }
    };
  }, []);

  // App restart or returning to the screen: pick up an activity that was still being recorded.
  useEffect(() => {
    let cancelled = false;
    async function resume() {
      try {
        if (!capabilities.backgroundLocation) {
          if (!cancelled) setResumeReady(true);
          return;
        }
        const active = await getActiveActivitySession();
        if (!active || cancelled) {
          if (!cancelled) setResumeReady(true);
          return;
        }
        const info = await activitySessionInfo(active.id);
        if (!info) {
          await setActiveActivitySession(null);
          await stopBackgroundLocationUpdates();
          if (!cancelled) setResumeReady(true);
          return;
        }
        sessionId.current = active.id;
        started.current = info.startedAt;
        paused.current = active.paused;
        const stored = await activityPointsForSession(active.id);
        if (cancelled) return;
        setPicked(routeKind(info.kind));
        setPoints(stored);
        setStatus(active.paused ? "paused" : "recording");
        const foreground = await Location.getForegroundPermissionsAsync();
        if (!foreground.granted) {
          setMessage("Location access was turned off while this activity was recording. The route so far is kept; you can stop and save it.");
          setResumeReady(true);
          return;
        }
        await attachForegroundWatcher();
        const background = await Location.getBackgroundPermissionsAsync();
        if (background.granted) {
          const running = (await isBackgroundLocationRunning()) || (await startBackgroundLocationUpdates()).started;
          updateBackgroundEnabled(running);
          setMessage(
            active.paused
              ? running
                ? "Resumed a paused activity. Background location is on for this session."
                : "Resumed a paused activity. Background location could not start — keep this screen open, or grant Always location."
              : running
                ? "Resumed an activity that was still being recorded. Background location is on for this session."
                : "Resumed an activity. Background location could not start — keep this screen open while recording.",
          );
        } else {
          updateBackgroundEnabled(false);
          setMessage(
            active.paused
              ? "This activity was paused because recording left this screen without Always location. Resume here to continue, or grant Always location for lock-screen tracking."
              : "Resumed an activity. Background location is off — keep this screen open while recording, or grant Always location for lock-screen tracking.",
          );
        }
      } catch {
        if (!cancelled) setMessage("An unfinished activity could not be reopened.");
      } finally {
        if (!cancelled) setResumeReady(true);
      }
    }
    void resume();
    return () => {
      cancelled = true;
    };
  }, []);

  async function start() {
    if (!resumeReady || starting || sessionId.current || status === "recording" || status === "paused") return;
    if (!capabilities.backgroundLocation) {
      setMessage(copy.gpsNativeOnly);
      return;
    }
    setStarting(true);
    try {
      const existing = await getActiveActivitySession();
      if (existing) {
        setMessage("An activity is already in progress. Resume it or stop it before starting another.");
        return;
      }
      setMessage("Location is used to draw the route of this activity. It is not collected beforehand.");
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (!foreground.granted) {
        setLocationBlocked(true);
        setMessage("Location is off, so a route cannot be recorded. Open system settings to allow location for VitaCore.");
        return;
      }
      setLocationBlocked(false);
      const background = await Location.requestBackgroundPermissionsAsync();

      stopping.current = false;
      paused.current = false;
      started.current = new Date().toISOString();
      setPoints([]);
      const id = await beginActivitySession({ kind, startedAt: started.current, timezone: deviceTimeZone() });
      sessionId.current = id;
      await setActiveActivitySession({ id, paused: false });
      setStatus("recording");

      if (background.granted) {
        const result = await startBackgroundLocationUpdates();
        updateBackgroundEnabled(result.started);
        setMessage(
          result.started
            ? "Recording with background location. Lock-screen continuity depends on Always permission and has not been device-verified in this environment."
            : `Background recording could not start (${result.reason}). Keep this screen open — leaving it will pause recording.`,
        );
      } else {
        updateBackgroundEnabled(false);
        setMessage(
          "Background location is off. Points are saved only while this screen stays open. Leaving the screen or app pauses recording so the route is not silently cut short.",
        );
      }
      await attachForegroundWatcher();
    } catch (error) {
      const id = sessionId.current;
      if (id) {
        // If startup failed after creating the session, keep it recoverable but do not leave GPS running.
        paused.current = true;
        try {
          await setActiveActivitySession({ id, paused: true });
          setForegroundWriterActive(false);
          watch.current?.remove();
          watch.current = null;
          await stopBackgroundLocationUpdates();
        } catch {
          // Keep the original startup error for the user-facing message.
        }
        updateBackgroundEnabled(false);
        setStatus("paused");
      }
      setMessage(
        error instanceof Error
          ? `Could not start activity: ${error.message}. Check location permissions and try again.`
          : "Could not start activity. Check location permissions and try again.",
      );
    } finally {
      setStarting(false);
    }
  }

  async function togglePause(next: boolean) {
    const id = sessionId.current;
    if (!id) return;

    if (next) {
      // Persist pause before stopping native updates so a late callback cannot add points.
      paused.current = true;
      await setActiveActivitySession({ id, paused: true });
      watch.current?.remove();
      watch.current = null;
      setForegroundWriterActive(false);
      await stopBackgroundLocationUpdates();
      updateBackgroundEnabled(false);
      setStatus("paused");
      setMessage("Activity paused. GPS updates are stopped to save battery. Resume to continue recording.");
      return;
    }

    const foregroundPermission = await Location.getForegroundPermissionsAsync();
    if (!foregroundPermission.granted) {
      setMessage("Location permission is off. Allow location access before resuming this activity.");
      return;
    }
    paused.current = false;
    await setActiveActivitySession({ id, paused: false });
    await attachForegroundWatcher();
    setStatus("recording");
    const permission = await Location.getBackgroundPermissionsAsync();
    if (permission.granted) {
      const result = await startBackgroundLocationUpdates();
      updateBackgroundEnabled(result.started);
      setMessage(
        result.started
          ? "Recording resumed with background location."
          : `Recording resumed in the foreground only (${result.reason}). Keep VitaCore open or grant Always location.`,
      );
    } else {
      updateBackgroundEnabled(false);
      setMessage("Recording resumed. Keep VitaCore open; Always location is needed for lock-screen tracking.");
    }
  }

  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    const id = sessionId.current;
    try {
      // Mark paused first; any late background callback will refuse to persist another point.
      if (id) await setActiveActivitySession({ id, paused: true });
      paused.current = true;
      setForegroundWriterActive(false);
      watch.current?.remove();
      watch.current = null;
      await stopBackgroundLocationUpdates();
      if (id) {
        // Include points captured while the screen was off before finalizing the saved session.
        const stored = await activityPointsForSession(id);
        const finalPoints = mergeGeoPoints(points, stored);
        await finishActivitySession(id, {
          endedAt: new Date().toISOString(),
          distanceMeters: trackDistanceMeters(finalPoints),
          movingSeconds: Math.round(computeMovingSeconds(finalPoints)),
        });
        setPoints(finalPoints);
        await setActiveActivitySession(null);
      }
      sessionId.current = null;
      updateBackgroundEnabled(false);
      setStatus("saved");
      setMessage("Activity saved on this device.");
    } catch (error) {
      // Keep the durable session marker so the user can reopen and recover an unfinished activity.
      setStatus("paused");
      setMessage(error instanceof Error ? `Could not finish saving this activity: ${error.message}` : "Could not finish saving this activity. Your unfinished activity has been kept for recovery.");
    } finally {
      stopping.current = false;
    }
  }

  const distance = trackDistanceMeters(points);
  const seconds = computeMovingSeconds(points);
  const pace = paceSecondsPerKilometer(distance, seconds);
  const gain = elevationGainMeters(points);
  const energy = estimatedActivityKcal({ kind, durationSeconds: seconds, weightKg: profile?.weightKg ?? null });
  const splitMeters = units === "imperial" ? 1609.344 : 1000;

  return (
    <Screen>
      <AppText variant="h1">Record</AppText>
      <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
        {(["walk", "run", "cycle", "hike"] as Kind[]).map((item) => (
          <Button key={item} label={item} tone={kind === item ? "primary" : "secondary"} onPress={() => setPicked(item)} />
        ))}
      </View>
      <View style={{ height: space.lg }} />
      <RouteMap points={points} live={status === "recording" || status === "paused"} height={240} />
      <View style={{ height: space.md }} />
      <AppText variant="metric" style={{ fontSize: 42 }}>{formatDistance(distance, units)}</AppText>
      <AppText variant="small">{formatClockDuration(seconds)}{pace ? ` · ${formatPace(pace, units)}` : ""}</AppText>
      <AppText variant="caption">{gain == null ? "Elevation was not reported by this device." : `Elevation gain ${Math.round(gain)} m`}</AppText>
      <AppText variant="caption">Moving time excludes long pauses between points. Heart rate and cadence are not attached unless a health source provides them.</AppText>
      {energy ? <AppText variant="caption">{energy.kcal} kcal. {energy.disclaimer}</AppText> : null}
      {(status === "recording" || status === "paused") && !backgroundEnabled ? (
        <AppText variant="caption" color={colors.accent}>
          Foreground-only recording: keep VitaCore open. Lock-screen tracking needs Always location permission.
        </AppText>
      ) : null}
      <View style={{ height: space.md }} />
      {status === "idle" || status === "saved" ? (
        <Button label={starting || !resumeReady ? "Starting…" : "Start"} onPress={() => void start()} disabled={starting || !resumeReady} />
      ) : null}
      {status === "recording" ? <Button label="Pause" tone="secondary" onPress={() => void togglePause(true)} /> : null}
      {status === "paused" ? <Button label="Resume" onPress={() => void togglePause(false)} /> : null}
      {status === "recording" || status === "paused" ? (
        <View style={{ marginTop: space.sm }}>
          <Button label="Stop and save" tone="danger" onPress={() => void stop()} />
        </View>
      ) : null}
      <View style={{ height: space.lg }} />
      {buildSplits(points, splitMeters).map((split) => (
        <AppText key={split.index} variant="small">
          Split {split.index} ·{" "}
          {split.paceSecondsPerKilometer == null ? "pace unavailable across a pause" : formatPace(split.paceSecondsPerKilometer, units)}
        </AppText>
      ))}
      {message ? <AppText variant="small" color={colors.textSecondary}>{message}</AppText> : null}
      {locationBlocked ? (
        <>
          <View style={{ height: space.md }} />
          <ErrorState
            title="Location permission needed"
            body="Recording a route needs While Using location. Always location is only for lock-screen continuity after you start an activity."
            action={{ label: "Open system settings", onPress: () => void openAppSettings() }}
          />
        </>
      ) : null}
      <AppText variant="caption">{copy.mapTiles}</AppText>
    </Screen>
  );
}
