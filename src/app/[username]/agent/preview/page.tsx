import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentPublic } from "@/components/agent/AgentPublic";

export default async function AgentPreviewPage({
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

  if (!user || user.id !== profile.id) {
    redirect(`/${username}/agent`);
  }

  return <AgentPublic profile={profile} isPreview />;
}
