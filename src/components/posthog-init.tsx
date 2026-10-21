"use client";

import { useEffect } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { identifyUser, initPostHog } from "@/lib/posthog";

// Mounted once in the root layout. Skips /sandbox (untrusted user HTML with
// its own locked-down CSP).
export function PostHogInit() {
  const { userId } = useAuth();

  useEffect(() => {
    if (window.location.pathname.startsWith("/sandbox")) return;
    if (initPostHog()) identifyUser(userId);
  }, [userId]);

  return null;
}
