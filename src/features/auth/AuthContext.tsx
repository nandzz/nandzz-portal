"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, PlanEntitlements } from "@/lib/types";
import { DEFAULT_FLAGS, type FeatureFlags } from "@/lib/flags";

// Free-plan entitlements — the safe default while loading and the fallback when
// the catalog is unseeded. Mirrors FREE_FALLBACK in lib/plan.ts.
export const FREE_ENTITLEMENTS: PlanEntitlements = {
  spaceLimit: 25,
  hasWidgets: false,
  hasMcp: false,
  hasAnalytics: false,
  monthlyCredits: 0,
};

type AuthContextValue = {
  userId: string | null;
  profile: Profile | null;
  entitlements: PlanEntitlements;
  /** Runtime, admin-controlled flags (e.g. the AI master switch). */
  flags: FeatureFlags;
  /** Re-reads the signed-in user's profile row + plan entitlements. */
  refetchProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  initialUserId: string | null;
  initialProfile: Profile | null;
  /** Plan gating resolved server-side for `initialProfile`, so plan-gated nav
      (Analytics, MCP, widgets) renders on first paint instead of popping in. */
  initialEntitlements?: PlanEntitlements;
  /** Resolved server-side from `app_settings` and seeded so the chrome renders
      the right surfaces on first paint (no flash, no client round-trip). */
  initialFlags?: FeatureFlags;
  children: React.ReactNode;
}

// Single client-side owner of { userId, profile, entitlements } for the app
// chrome (AppChrome / Navbar / Sidebar / MobileTabBar). Subscribes to
// `onAuthStateChange` exactly ONCE for the whole app and fetches the profile
// row + derives plan entitlements in a single pass — the four chrome
// components used to each independently call `getUser()` / fetch the profile
// / resolve entitlements, multiplying `/auth/v1/user` round-trips and
// `profiles` / `subscription_plans` reads on every dashboard load.
//
// Lives OUTSIDE `components/` (like `auth.ts` / `realtime.ts`) so it can touch
// `@/lib/supabase/*` directly without tripping the `no-restricted-imports`
// guardrail that applies to `src/features/*/components/**`.
export function AuthProvider({ initialUserId, initialProfile, initialEntitlements, initialFlags, children }: AuthProviderProps) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [entitlements, setEntitlements] = useState<PlanEntitlements>(initialEntitlements ?? FREE_ENTITLEMENTS);
  // Flags are server-resolved and stable for the page's lifetime, so they're
  // held as-is (no refetch); default OFF until the server seeds them.
  const flags = initialFlags ?? DEFAULT_FLAGS;

  // The user id the currently-held `profile` was fetched (or SSR-seeded) for.
  // Lets the first INITIAL_SESSION event below skip re-fetching the profile
  // when it already matches what the server sent down as `initialProfile`.
  const loadedProfileUserId = useRef<string | null>(initialProfile ? initialUserId : null);

  // Monotonic token guarding against out-of-order async loads. Each `loadForUser`
  // captures the current value; a later auth event (notably SIGNED_OUT, which
  // bumps it) invalidates any in-flight load so its awaited `setProfile` /
  // `setEntitlements` can't resurrect stale state after sign-out.
  const loadSeq = useRef(0);

  const fetchEntitlementsForSlug = useCallback(
    async (planSlug: string | null | undefined): Promise<PlanEntitlements> => {
      const slug = planSlug ?? "free";
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("has_widgets, has_mcp, has_analytics, space_limit, monthly_credits")
        .eq("slug", slug)
        .maybeSingle();
      if (!plan) return FREE_ENTITLEMENTS;
      return {
        spaceLimit: plan.space_limit,
        hasWidgets: !!plan.has_widgets,
        hasMcp: !!plan.has_mcp,
        hasAnalytics: !!plan.has_analytics,
        monthlyCredits: plan.monthly_credits ?? 0,
      };
    },
    [supabase]
  );

  // Fetches the full profile row and derives entitlements from its
  // `plan_slug` — one `profiles` read plus one `subscription_plans` lookup,
  // instead of the separate `getUser()` + `profiles(plan_slug)` +
  // `profiles(*)` queries the old per-component fetchers issued between them.
  const loadForUser = useCallback(
    async (uid: string) => {
      const seq = ++loadSeq.current;
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
      if (seq !== loadSeq.current) return; // superseded by a newer auth event
      const nextProfile = (data as Profile) ?? null;
      setProfile(nextProfile);
      loadedProfileUserId.current = uid;
      const nextEntitlements = await fetchEntitlementsForSlug(nextProfile?.plan_slug);
      if (seq !== loadSeq.current) return; // superseded while resolving the plan
      setEntitlements(nextEntitlements);
    },
    [supabase, fetchEntitlementsForSlug]
  );

  const refetchProfile = useCallback(async () => {
    if (!userId) return;
    await loadForUser(userId);
  }, [userId, loadForUser]);

  // Seed entitlements once on mount for the SSR-seeded user when the server
  // didn't send them (the profile itself is already current).
  useEffect(() => {
    if (initialUserId && initialProfile && !initialEntitlements) {
      fetchEntitlementsForSlug(initialProfile.plan_slug).then(setEntitlements);
    }
    // Runs once for the SSR-seeded initial values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Calling any auth method synchronously inside an `onAuthStateChange`
      // callback deadlocks supabase-js: the auth operation that fired the
      // event (e.g. `updateUser({ phone })` for phone verification) awaits
      // its listeners, while a synchronous call here would queue behind that
      // same operation — neither can finish. Defer with setTimeout(0) so the
      // work below runs after the emit completes, outside the lock. Without
      // this, `updateUser`/`verifyOtp` hang forever (UI stuck on "Sending…",
      // no error).
      setTimeout(() => {
        if (event === "SIGNED_OUT" || !session?.user) {
          loadSeq.current++; // invalidate any in-flight profile load
          setUserId(null);
          setProfile(null);
          setEntitlements(FREE_ENTITLEMENTS);
          loadedProfileUserId.current = null;
          return;
        }

        const uid = session.user.id;
        setUserId(uid);

        if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
          // The first INITIAL_SESSION for the SSR-seeded user is already
          // covered by `initialProfile` (handled in the mount effect above) —
          // skip the redundant profile fetch, only entitlements were needed.
          if (event === "INITIAL_SESSION" && loadedProfileUserId.current === uid) {
            return;
          }
          loadForUser(uid);
        }
      }, 0);
    });

    return () => subscription.unsubscribe();
    // Subscribes exactly once for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // The chrome dispatches this after mutating the profile row directly
  // (`setAccountType`) or via a dashboard form (settings / brand / profile
  // editor) — re-read so every consumer of `useAuth()` picks up the change.
  useEffect(() => {
    const handler = () => {
      if (userId) loadForUser(userId);
    };
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, [userId, loadForUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ userId, profile, entitlements, flags, refetchProfile }),
    [userId, profile, entitlements, flags, refetchProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

/** Convenience accessor for the runtime feature flags. */
export function useFeatureFlags(): FeatureFlags {
  return useAuth().flags;
}
