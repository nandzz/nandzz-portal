import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentStudio } from "@/components/agent/AgentStudio";
import { AgentPublic } from "@/components/agent/AgentPublic";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
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

  return <AgentPublic profile={profile} />;
}
