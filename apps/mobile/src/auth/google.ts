import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import { brandConfig } from "@vitacore/brand";
import { getSupabase, supabaseConfigStatus } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export type GoogleSignInResult =
  | { ok: true }
  | { ok: false; reason: "missing_config" | "cancelled" | "no_url" | "failed"; message: string };

export function googleRedirectUri(): string {
  return makeRedirectUri({
    scheme: brandConfig.scheme,
    path: "auth/callback",
  });
}

export async function createSessionFromUrl(url: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, message: "Supabase is not configured." };
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) return { ok: false, message: String(errorCode) };
  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (!access_token || !refresh_token) {
    return { ok: false, message: "The sign-in redirect did not include a session." };
  }
  const { error } = await client.auth.setSession({ access_token, refresh_token });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/**
 * Google OAuth through Supabase. Never reports success unless a real session is stored.
 * Requires EXPO_PUBLIC_SUPABASE_* env vars and Google enabled in the Supabase project.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (supabaseConfigStatus() !== "ready") {
    return {
      ok: false,
      reason: "missing_config",
      message:
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, enable Google in Supabase Auth, and register the redirect URL. Sign-in is not simulated.",
    };
  }
  const client = getSupabase();
  if (!client) {
    return {
      ok: false,
      reason: "missing_config",
      message: "Supabase client could not be created from the public env vars.",
    };
  }

  const redirectTo = googleRedirectUri();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });
  if (error) return { ok: false, reason: "failed", message: error.message };
  if (!data.url) return { ok: false, reason: "no_url", message: "Supabase did not return an OAuth URL." };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "cancel" || result.type === "dismiss") {
    return { ok: false, reason: "cancelled", message: "Google sign-in was cancelled." };
  }
  if (result.type !== "success" || !("url" in result) || !result.url) {
    return { ok: false, reason: "failed", message: "Google sign-in did not complete." };
  }
  const session = await createSessionFromUrl(result.url);
  if (!session.ok) return { ok: false, reason: "failed", message: session.message };
  return { ok: true };
}
