import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ClaimFlow, type ClaimState } from "@/features/claim";

export const metadata: Metadata = {
  title: "Claim your profile",
  robots: { index: false, follow: false },
};

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; confirmed?: string }>;
}) {
  const { code, confirmed } = await searchParams;
  const initialCode = typeof code === "string" ? code.slice(0, 64).toUpperCase() : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let state: ClaimState = "anon";
  let username: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
    state = profile ? "has-profile" : "ready";
    username = profile?.username ?? null;
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-8">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-100/50 blur-3xl dark:bg-violet-950/25" />
      </div>
      <ClaimFlow
        state={state}
        initialCode={initialCode}
        email={user?.email ?? null}
        username={username}
        emailConfirmed={confirmed === "1"}
      />
    </div>
  );
}
