import { useEffect, useState } from "react";
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from "@expo-google-fonts/outfit";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme, useRouter, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AppState, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { decideHealthGate } from "@vitacore/domain";
import "@/activity/backgroundLocation";
import { AuthProvider, useAuth } from "@/auth/session";
import { AppStateProvider, useAppState } from "@/data/app-state";
import { initSync } from "@/data/sync";
import { getHealthPermissionStatus } from "@/health";
import { currentGoalProgress } from "@/notifications/goals";
import {
  configureNotifications,
  routeForNotificationResponse,
  syncReminders,
  syncSmartAlarm,
} from "@/notifications/scheduler";
import { ThemeProvider, useTheme } from "@/design/theme";
import { AppErrorBoundary, RouteErrorBoundary } from "@/components/app-error-boundary";
import { ErrorState, LoadingState } from "@/components/ui";

export { RouteErrorBoundary as ErrorBoundary };

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function platformKind(): "android" | "ios" | "web" | "other" {
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "web") return "web";
  return "other";
}

function Gate() {
  const { ready, bootError, profile } = useAppState();
  const auth = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const onboarded = Boolean(profile?.onboardingCompletedAt);
  const signedIn = Boolean(auth.session);
  const [healthReady, setHealthReady] = useState<boolean | null>(Platform.OS === "android" ? null : false);
  const [healthChecked, setHealthChecked] = useState(Platform.OS !== "android");

  useEffect(() => {
    if (!ready || bootError || !auth.ready || !signedIn) return;
    let cancelled = false;

    async function verifyHealth() {
      if (Platform.OS !== "android") {
        if (!cancelled) {
          setHealthReady(false);
          setHealthChecked(true);
        }
        return;
      }
      try {
        const status = await getHealthPermissionStatus();
        if (!cancelled) {
          setHealthReady(status.allGranted);
          setHealthChecked(true);
        }
      } catch {
        if (!cancelled) {
          setHealthReady(false);
          setHealthChecked(true);
        }
      }
    }

    void verifyHealth();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void verifyHealth();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [ready, bootError, auth.ready, signedIn]);

  useEffect(() => {
    if (!ready || bootError || !auth.ready) return;
    const route = String((segments as readonly string[])[0] ?? "");
    const onSignIn = route === "sign-in";
    const onHealthSetup = route === "health-setup";
    const onOnboarding = route === "onboarding";
    const go = (href: string) => router.replace(href as Parameters<typeof router.replace>[0]);

    // 1) Google sign-in first (no guest entry).
    if (!signedIn && !onSignIn) {
      go("/sign-in");
      return;
    }
    if (signedIn && onSignIn) {
      go(Platform.OS === "android" || Platform.OS === "ios" || Platform.OS === "web" ? "/health-setup" : onboarded ? "/" : "/onboarding");
      return;
    }
    if (!signedIn) return;

    // 2) Health Connect gate (Android mandatory; iOS explainer; web preview escape on that screen).
    if (!healthChecked) return;
    const gate = decideHealthGate({
      platform: platformKind(),
      androidAllGranted: Platform.OS === "android" ? healthReady : null,
    });

    if (Platform.OS === "android") {
      if (!healthReady) {
        if (!onHealthSetup) go("/health-setup");
        return;
      }
      if (onHealthSetup) {
        go(onboarded ? "/" : "/onboarding");
        return;
      }
    } else if (Platform.OS === "ios") {
      if (gate.action === "platform_unsupported" && !onHealthSetup) {
        go("/health-setup");
        return;
      }
      if (onHealthSetup) return;
    } else if (Platform.OS === "web") {
      if (!onHealthSetup && !onOnboarding && !onboarded) {
        go("/health-setup");
        return;
      }
    }

    // 3) Onboarding questions, then app.
    if (Platform.OS === "android" || (Platform.OS === "web" && !onHealthSetup) || Platform.OS === "ios") {
      if (Platform.OS === "ios" && onHealthSetup) return;
      if (!onboarded && !onOnboarding && !onHealthSetup) {
        go("/onboarding");
        return;
      }
      if (onboarded && onOnboarding) go("/");
    }
  }, [auth.ready, bootError, healthChecked, healthReady, onboarded, ready, router, segments, signedIn]);

  useEffect(() => {
    if (!ready || bootError) return;
    let cancelled = false;
    function resync() {
      void currentGoalProgress(profile)
        .then(async (goals) => {
          await syncReminders(goals, new Date(), profile?.sleepTargetMinutes ?? null);
          await syncSmartAlarm();
        })
        .catch(() => undefined);
    }
    void configureNotifications().then(() => {
      if (!cancelled) resync();
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeForNotificationResponse(response);
      if (route) router.push(route as Parameters<typeof router.push>[0]);
    });
    const appStateSubscription = AppState.addEventListener("change", (next) => {
      if (next === "active") resync();
    });
    return () => {
      cancelled = true;
      responseSubscription.remove();
      appStateSubscription.remove();
    };
  }, [ready, bootError, profile, router]);

  if (!ready || !auth.ready) return <LoadingState label="Opening your local record" />;
  if (bootError) return <ErrorState title="This device could not open its database" body={bootError} />;
  if (signedIn && !healthChecked) return <LoadingState label="Checking Health Connect…" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="health-setup" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="profile" options={{ presentation: "modal" }} />
      <Stack.Screen name="account" />
      <Stack.Screen name="reminders" />
      <Stack.Screen name="sleep-alarm" />
      <Stack.Screen name="health" />
      <Stack.Screen name="readiness" />
      <Stack.Screen name="coach" />
      <Stack.Screen name="progress" />
      <Stack.Screen name="programs" />
      <Stack.Screen name="record" />
      <Stack.Screen name="activity/[id]" />
      <Stack.Screen name="food/new" />
      <Stack.Screen name="food/[id]" />
      <Stack.Screen name="workout/[id]" />
      <Stack.Screen name="search" />
      <Stack.Screen name="scan" />
      <Stack.Screen name="sounds" />
      <Stack.Screen name="exercises" />
    </Stack>
  );
}

function ThemedApp() {
  const { theme } = useAppState();
  return (
    <ThemeProvider preference={theme}>
      <Chrome />
    </ThemeProvider>
  );
}

function Chrome() {
  const { colors, name } = useTheme();
  const navigationTheme = name === "dark" ? DarkTheme : DefaultTheme;
  return (
    <NavigationTheme value={{ ...navigationTheme, colors: { ...navigationTheme.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent } }}>
      <StatusBar style={name === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: 480, backgroundColor: colors.background, overflow: "hidden" }}>
          <Gate />
        </View>
      </View>
    </NavigationTheme>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold });
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);
  useEffect(() => initSync(), []);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppStateProvider>
          <AuthProvider>
            <ThemedApp />
          </AuthProvider>
        </AppStateProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
