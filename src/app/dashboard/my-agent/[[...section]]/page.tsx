export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";
import { getFeatureFlags } from "@/lib/featureFlags";
import { FEATURES } from "@/lib/flags";
import { PageShell } from "@/components/layout/PageShell";
import { MyAgentWorkspace, myAgentTabFromSegment } from "@/features/my-agent";
import { loadMyAgentActivity } from "@/features/my-agent/server/load-activity";

// My Agent — the owner's private WhatsApp assistant. Dev environments only for
// now (FEATURES.businessAgent). Activity (feed + approvals) is real data; the
// other tabs still render placeholders.
// Tab deep-links hang off the base path (`/dashboard/my-agent/{tab}`).
// Server components render once per request, so reading the clock here is
// stable; it anchors every placeholder timestamp for server + client alike.
const requestTime = () => Date.now();

export default async function MyAgentPage({ params }: { params: Promise<{ section?: string[] }> }) {
  if (!FEATURES.businessAgent) notFound();

  const { section } = await params;
  if (section && section.length > 1) notFound();
  const initialTab = myAgentTabFromSegment(section?.[0]);
  if (initialTab === null) notFound();

  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login");
  if ((await getAccountType(supabase, userId)) !== "business") redirect("/dashboard/feed");

  // The Knowledge Studio still lives at /dashboard/agent behind the AI switch.
  const [{ ai }, activity] = await Promise.all([getFeatureFlags(), loadMyAgentActivity(supabase, userId)]);

  return (
    <PageShell width="content">
      <MyAgentWorkspace initialTab={initialTab} now={requestTime()} knowledgeStudioHref={ai ? "/dashboard/agent" : null} activity={activity} />
    </PageShell>
  );
}
