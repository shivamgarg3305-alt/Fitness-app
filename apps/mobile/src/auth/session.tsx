import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as Linking from "expo-linking";
import type { Session, User } from "@supabase/supabase-js";
import { createSessionFromUrl } from "./google";
import { getSupabase, supabaseConfigStatus } from "./supabase";

type AuthValue = {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<{ ok: true } | { ok: false; message: string }>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const configured = supabaseConfigStatus() === "ready";

  const refresh = useCallback(async () => {
    const client = getSupabase();
    if (!client) {
      setSession(null);
      return;
    }
    const { data } = await client.auth.getSession();
    setSession(data.session ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    const client = getSupabase();
    if (!client) return () => {
      cancelled = true;
    };
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  // Deep-link / cold-start OAuth return (email links and some native redirects).
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url || !url.includes("access_token")) return;
      void createSessionFromUrl(url).then(() => refresh());
    };
    const sub = Linking.addEventListener("url", ({ url }) => handle(url));
    void Linking.getInitialURL().then(handle);
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      configured,
      session,
      user: session?.user ?? null,
      refresh,
      signOut: async () => {
        const client = getSupabase();
        if (!client) return { ok: false, message: "Supabase is not configured." };
        const { error } = await client.auth.signOut();
        if (error) return { ok: false, message: error.message };
        setSession(null);
        return { ok: true };
      },
    }),
    [ready, configured, session, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
