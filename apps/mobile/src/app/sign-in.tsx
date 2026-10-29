import { useState } from "react";
import { View } from "react-native";
import { brandConfig } from "@vitacore/brand";
import { GlassButton, GlassCard, GlassHeader } from "@/components/glass";
import { AppText, Screen } from "@/components/ui";
import { signInWithGoogle, googleRedirectUri } from "@/auth/google";
import { useAuth } from "@/auth/session";
import { useSyncStatus, confirmLocalDataClaim } from "@/data/sync";
import { copy } from "@/i18n/copy";
import { space } from "@/design/tokens";
import { useTheme } from "@/design/theme";

export default function SignInScreen() {
  const { colors } = useTheme();
  const { configured, session, refresh } = useAuth();
  const sync = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onGoogle() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await signInWithGoogle();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      await refresh();
      setMessage("Signed in with Google.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <GlassHeader eyebrow={brandConfig.name} title="Sign in to continue" />
      <View style={{ height: space.lg }} />
      <GlassCard>
        <AppText variant="body" color={colors.textSecondary}>
          VitaCore uses Google sign-in for your account. There is no guest path on this screen. Local records already on
          this device are not uploaded until you explicitly associate them after sign-in.
        </AppText>
        <View style={{ height: space.md }} />
        <AppText variant="small" color={colors.textSecondary}>
          {copy.localDataClaim}
        </AppText>
      </GlassCard>
      <View style={{ height: space.lg }} />
      {!configured ? (
        <GlassCard>
          <AppText variant="h3">Cloud sign-in is not configured</AppText>
          <View style={{ height: space.sm }} />
          <AppText variant="small" color={colors.textSecondary}>
            Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, enable the Google provider in Supabase,
            and allow redirect {googleRedirectUri()}. This screen will not pretend sign-in succeeded.
          </AppText>
        </GlassCard>
      ) : null}
      <View style={{ height: space.lg }} />
      <GlassButton
        label={busy ? "Opening Google…" : "Continue with Google"}
        onPress={() => void onGoogle()}
        disabled={busy || !configured || Boolean(session)}
      />
      {session ? (
        <>
          <View style={{ height: space.md }} />
          <AppText variant="small">Signed in as {session.user.email ?? session.user.id}</AppText>
          {sync.status === "claim_required" ? (
            <>
              <View style={{ height: space.sm }} />
              <AppText variant="small" color={colors.accent}>
                {copy.localDataClaim}
              </AppText>
              <View style={{ height: space.sm }} />
              <GlassButton
                label="Associate local data with this account"
                tone="secondary"
                onPress={() => {
                  confirmLocalDataClaim();
                  setMessage("Local data association confirmed for sync.");
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
      <View style={{ height: space.md }} />
      {message ? <AppText variant="small">{message}</AppText> : null}
      <AppText variant="caption" color={colors.textMuted}>
        Email/password remains available under Account for recovery after you are signed in. Google is the intended first
        launch path.
      </AppText>
    </Screen>
  );
}
