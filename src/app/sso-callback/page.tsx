"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/authConfig";

/** Google sign-in returns here; Clerk completes the session and redirects to the app. */
export default function SsoCallbackPage() {
  return isClerkConfigured() ? <AuthenticateWithRedirectCallback /> : null;
}
