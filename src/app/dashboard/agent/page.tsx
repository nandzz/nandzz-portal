import { notFound, redirect } from "next/navigation";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { AgentStudio } from "@/features/agent";
import { getFeatureFlags } from "@/lib/featureFlags";

export default async function DashboardAgentPage() {
  if (!(await getFeatureFlags()).ai) notFound();

  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);

  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) notFound();

  return <AgentStudio profile={profile} />;
}
