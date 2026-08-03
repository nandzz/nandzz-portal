import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentStudio } from "@/components/agent/AgentStudio";
import { AgentPublic } from "@/components/agent/AgentPublic";
import { FEATURES } from "@/lib/flags";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  if (!FEATURES.agent) notFound();

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

  const isOwner = user?.id === profile.id;

  if (isOwner) {
    return <AgentStudio profile={profile} />;
  }

  // Disabled agents are hidden from everyone but the owner.
  if (!profile.agent_enabled) notFound();

  const { count } = await admin
    .from("agent_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("visibility", "public")
    .eq("status", "active");

  return <AgentPublic profile={profile} hasDocuments={(count ?? 0) > 0} isAuthenticated={!!user} />;
}
