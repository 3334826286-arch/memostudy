"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [lastAuthEvent, setLastAuthEvent] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const client = getSupabaseBrowserClient();

    if (!client) {
      setIsReady(true);
      return undefined;
    }

    let mounted = true;

    client.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) {
          return;
        }

        const nextSession = data.session ?? null;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setIsReady(true);
      })
      .catch(() => {
        if (mounted) {
          setIsReady(true);
        }
      });

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) {
        return;
      }

      setLastAuthEvent(event);
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setIsReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn({ email, password }) {
    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error("Supabase Auth is not configured.");
    }

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }

  async function signUp({ email, password, fullName, emailRedirectTo }) {
    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error("Supabase Auth is not configured.");
    }

    const { error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      throw error;
    }
  }

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
  }

  async function sendPasswordReset(email, redirectTo) {
    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error("Supabase Auth is not configured.");
    }

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) {
      throw error;
    }
  }

  async function updatePassword({ password, fullName }) {
    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error("Supabase Auth is not configured.");
    }

    const { error } = await client.auth.updateUser({
      password,
      data: fullName ? { full_name: fullName } : undefined
    });

    if (error) {
      throw error;
    }
  }

  function clearLastAuthEvent() {
    setLastAuthEvent("");
  }

  const value = useMemo(
    () => ({
      client: getSupabaseBrowserClient(),
      isConfigured: isSupabaseConfigured(),
      isReady,
      session,
      user,
      displayName: user?.user_metadata?.full_name ?? user?.email ?? "",
      lastAuthEvent,
      clearLastAuthEvent,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword
    }),
    [isReady, session, user, lastAuthEvent]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
