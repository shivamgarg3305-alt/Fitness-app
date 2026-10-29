import { useState } from "react";
import { View } from "react-native";
import { AppText, Button, Screen, TextField } from "@/components/ui";
import { GlassButton, GlassCard } from "@/components/glass";
import { googleRedirectUri, signInWithGoogle } from "@/auth/google";
import { useAuth } from "@/auth/session";
import { useSyncStatus, confirmLocalDataClaim } from "@/data/sync";
import { copy } from "@/i18n/copy";
import { space } from "@/design/tokens";
import { useTheme } from "@/design/theme";
import { getSupabase } from "@/auth/supabase";

export default function AccountScreen() {
  const { colors } = useTheme();
  const auth = useAuth();
  const sync = useSyncStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionEmail = auth.user?.email ?? null;

  async function act(kind: "sign-up" | "sign-in" | "reset") {
    const client = getSupabase();
    if (!client) {
      setMessage("Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. The service role key does not belong in the app.");
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes("@")) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (kind !== "reset" && password.length < 6) {
      setMessage("Use a password with at least 6 characters.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (kind === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(trimmedEmail);
        setMessage(error ? error.message : "If the address is registered, a reset message is on its way.");
        return;
      }
      const method =
        kind === "sign-up"
          ? client.auth.signUp({ email: trimmedEmail, password })
          : client.auth.signInWithPassword({ email: trimmedEmail, password });
      const { error } = await method;
      setMessage(
        error
          ? error.message
          : kind === "sign-up"
            ? "Account created. Confirm the email if the project requires it. If this device already has local data, you must confirm associating it with this account before upload."
            : "Signed in. If this device has unbound local data, confirm associating it with this account before upload.",
      );
      await auth.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await signInWithGoogle();
      setMessage(result.ok ? "Signed in with Google." : result.message);
      if (result.ok) await auth.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      const result = await auth.signOut();
      setPassword("");
      setMessage(
        result.ok
          ? "Signed out. Local data on this device is unchanged and stays bound to the previous account for sync safety."
          : result.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppText variant="h1">Account</AppText>
      <AppText variant="small" color={colors.textSecondary}>{copy.guestCloud}</AppText>
      <View style={{ height: space.lg }} />
      {!auth.configured ? (
        <GlassCard>
          <AppText variant="small">
            Cloud sign-in needs EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Google enabled in Supabase,
            and redirect {googleRedirectUri()}.
          </AppText>
        </GlassCard>
      ) : null}
      <View style={{ height: space.md }} />
      {sessionEmail ? (
        <>
          <AppText variant="small">Signed in as {sessionEmail}</AppText>
          <View style={{ height: space.sm }} />
          {sync.status === "claim_required" ? (
            <>
              <AppText variant="small" color={colors.accent}>{copy.localDataClaim}</AppText>
              <View style={{ height: space.sm }} />
              <GlassButton
                label={busy ? "Working…" : "Associate local data with this account"}
                onPress={() => {
                  setMessage("Associating local data with this account…");
                  confirmLocalDataClaim();
                }}
                disabled={busy}
              />
              <View style={{ height: space.sm }} />
            </>
          ) : null}
          <GlassButton label={busy ? "Working…" : "Sign out"} tone="secondary" onPress={() => void signOut()} disabled={busy} />
          <View style={{ height: space.lg }} />
        </>
      ) : (
        <>
          <GlassButton
            label={busy ? "Opening Google…" : "Continue with Google"}
            onPress={() => void onGoogle()}
            disabled={busy || !auth.configured}
          />
          <View style={{ height: space.lg }} />
          <AppText variant="label">Email recovery</AppText>
          <View style={{ height: space.sm }} />
          <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <View style={{ height: space.sm }} />
          <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <View style={{ height: space.md }} />
          <Button label={busy ? "Working…" : "Create account"} onPress={() => void act("sign-up")} disabled={busy || !auth.configured} />
          <View style={{ height: space.sm }} />
          <Button label={busy ? "Working…" : "Sign in with email"} tone="secondary" onPress={() => void act("sign-in")} disabled={busy || !auth.configured} />
          <View style={{ height: space.sm }} />
          <Button label="Email a reset link" tone="ghost" onPress={() => void act("reset")} disabled={busy || !auth.configured} />
        </>
      )}
      <View style={{ height: space.md }} />
      {sync.status === "error" && sync.message ? (
        <AppText variant="small" color={colors.accent}>{sync.message}</AppText>
      ) : null}
      <AppText variant="caption">
        Google sign-in never reports success unless Supabase returns a real session. Local data is never silently reassigned.
      </AppText>
      {message ? <AppText variant="small">{message}</AppText> : null}
    </Screen>
  );
}
