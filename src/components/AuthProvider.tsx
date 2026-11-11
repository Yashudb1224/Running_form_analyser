"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useClerk, useSession, useSignIn, useUser } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/authConfig";
import { setSupabaseTokenGetter } from "@/lib/supabaseClient";

export interface AppUser {
  id: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
}

interface AuthContextValue {
  /** False when Clerk is not configured; the app then runs without login. */
  enabled: boolean;
  loading: boolean;
  user: AppUser | null;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const DISABLED: AuthContextValue = {
  enabled: false,
  loading: false,
  user: null,
  error: null,
  signInWithGoogle: async () => undefined,
  signOut: async () => undefined,
};

const AuthContext = createContext<AuthContextValue>(DISABLED);

/**
 * Provides the app's auth context. The layout wraps the app in ClerkProvider when Clerk is
 * configured; otherwise the app runs without sign-in.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured()) return <AuthContext.Provider value={DISABLED}>{children}</AuthContext.Provider>;
  return <ClerkAuthBridge>{children}</ClerkAuthBridge>;
}

/** Adapts Clerk's hooks to the app's auth context and hands Clerk session tokens to Supabase. */
function ClerkAuthBridge({ children }: { children: React.ReactNode }) {
  const { isLoaded, user } = useUser();
  const { session } = useSession();
  const { signIn } = useSignIn();
  const clerk = useClerk();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase verifies these Clerk tokens (third-party auth) and applies row-level security to them.
    setSupabaseTokenGetter(session ? () => session.getToken() : null);
  }, [session]);

  const signInWithGoogle = useCallback(async () => {
    if (!signIn) return;
    setError(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Google sign-in could not start.");
    }
  }, [signIn]);

  const signOut = useCallback(async () => {
    await clerk.signOut();
  }, [clerk]);

  const value = useMemo<AuthContextValue>(() => ({
    enabled: true,
    loading: !isLoaded,
    user: user
      ? {
        id: user.id,
        name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Account",
        email: user.primaryEmailAddress?.emailAddress ?? null,
        imageUrl: user.imageUrl ?? null,
      }
      : null,
    error,
    signInWithGoogle,
    signOut,
  }), [isLoaded, user, error, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
