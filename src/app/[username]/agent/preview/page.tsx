import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchPublicProfile } from "@/features/profile/server";
import { AgentPublic } from "@/features/agent";
import { getFeatureFlags } from "@/lib/featureFlags";

export default async function AgentPreviewPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const profile = await fetchPublicProfile(username);

  if (!(await getFeatureFlags()).ai || !profile) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== profile.id) {
    redirect(`/${username}/agent`);
  }

  return <AgentPublic profile={profile} isPreview />;
}
