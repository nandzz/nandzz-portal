export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SpaceGrid } from "@/components/spaces/SpaceGrid";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Layers, Plus, Rocket, Zap, AlertTriangle, BarChart2 } from "lucide-react";
import type { Space } from "@/lib/types";
import { FEATURES } from "@/lib/flags";

const FREE_SPACES_LIMIT = 5;

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: rawSpaces }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username, plan_tier")
      .eq("id", user.id)
      .single(),
    supabase
      .from("spaces")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const greeting = profile?.display_name || profile?.username || "there";
  const spaces: Space[] = (rawSpaces ?? []) as Space[];

  const isPro = (profile as { plan_tier?: string } | null)?.plan_tier === "pro";
  const atLimit = !isPro && spaces.length >= FREE_SPACES_LIMIT;
  const nearLimit = !isPro && spaces.length === FREE_SPACES_LIMIT - 1;

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      {/* Subtle background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* Page header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                <LayoutGrid className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">My Spaces</h1>
            </div>
            <p className="mt-2 text-muted-foreground text-lg">
              Welcome back, {greeting}. Manage your web app collection.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/analytics">
              <Button variant="outline" className="border-border/60 gap-2">
                <BarChart2 className="h-4 w-4" />
                Analytics
              </Button>
            </Link>
            <Link href="/dashboard/collections">
              <Button variant="outline" className="border-border/60 gap-2">
                <Layers className="h-4 w-4" />
                Collections
              </Button>
            </Link>
            <Link href="/dashboard/create-space">
              <Button>
                <Plus className="h-4 w-4" />
                Create Space
              </Button>
            </Link>
          </div>
        </div>

        {/* Space limit banners */}
        {FEATURES.monetization && atLimit && (
          <div className="mb-6 rounded-xl border border-orange-200 dark:border-orange-800/60 bg-orange-50/80 dark:bg-orange-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                  You&apos;ve reached your {FREE_SPACES_LIMIT}-space limit
                </p>
                <p className="text-xs text-orange-700/80 dark:text-orange-400/80 mt-0.5">
                  Upgrade to Pro for unlimited Spaces, private publishing, and more.
                </p>
              </div>
            </div>
            <Link href="/dashboard/billing?checkout=pro">
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm shrink-0 gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Upgrade to Pro
              </Button>
            </Link>
          </div>
        )}
        {FEATURES.monetization && nearLimit && (
          <div className="mb-6 rounded-xl border border-yellow-200 dark:border-yellow-800/60 bg-yellow-50/60 dark:bg-yellow-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-4 w-4 text-yellow-600 shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <span className="font-medium">1 Space remaining</span> on the Free plan.{" "}
                <Link href="/dashboard/billing" className="underline underline-offset-2 hover:text-yellow-900 dark:hover:text-yellow-200">
                  Upgrade to Pro
                </Link>{" "}
                for unlimited Spaces.
              </p>
            </div>
          </div>
        )}

        {spaces && spaces.length > 0 ? (
          <SpaceGrid spaces={spaces} showCreateCard editable currentUserId={user.id} ownerUsername={profile?.username || undefined} />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-100/80 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800">
              <Rocket className="h-10 w-10 text-violet-400 dark:text-violet-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No spaces yet</h2>
            <p className="text-muted-foreground max-w-sm mb-6">
              Create your first Space to start building your web app collection.
            </p>
            <Link href="/dashboard/create-space">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Space
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
