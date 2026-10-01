import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileWidgets } from "@/features/booking/server";
import { getPublicAgentDocCount } from "@/features/agent/server";
import { AgentPublic } from "@/features/agent";
import { getFeatureFlags } from "@/lib/featureFlags";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  if (!(await getFeatureFlags()).ai) notFound();

  const { username } = await params;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public client agent shown on the profile page. The owner-facing studio
  // lives separately at /dashboard/agent.
  //
  // HARD GATE: the agent is a subscription-gated widget now — it only exists
  // for visitors while the owner has a live (enabled + entitled) `agent`
  // widget instance. getProfileWidgets already applies that exact filter.
  const widgets = await getProfileWidgets(profile.id);
  const agentWidget = widgets.find((w) => w.catalog.slug === "agent");
  if (!agentWidget) notFound();

  const docCount = await getPublicAgentDocCount(admin, profile.id);

  return <AgentPublic profile={profile} hasDocuments={docCount > 0} isAuthenticated={!!user} />;
}
