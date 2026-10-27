import { notFound, redirect } from "next/navigation";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";
import { getCurrentLocale } from "@/lib/i18n/server";
import { PageShell } from "@/components/layout/PageShell";
import { MyAgentWorkspace } from "../components/MyAgentWorkspace";
import { myAgentTabFromSegment } from "../tabs";
import { loadMyAgentActivity } from "../server/load-activity";
import { loadMyAgentKnowledge, loadMyAgentSettings } from "../server/load-settings";
import { loadMyAgentConversations, loadWhatsAppConnection } from "../server/load-conversations";
import { loadMyAgentUsage } from "../server/load-usage";

// My Agent — the owner's private WhatsApp assistant. Rendered by the route
// `app/dashboard/my-agent/[[...section]]`, which imports this only when
// FEATURES.businessAgent is on (dev builds), so prod never bundles it.
// Every tab is real data; Workflows isn't built yet.
// Tab deep-links hang off the base path (`/dashboard/my-agent/{tab}`).
// Server components render once per request, so reading the clock here is
// stable; it anchors every relative timestamp for server + client alike.
const requestTime = () => Date.now();

export async function MyAgentPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  if (section && section.length > 1) notFound();
  const initialTab = myAgentTabFromSegment(section?.[0]);
  if (initialTab === null) notFound();

  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login");
  if ((await getAccountType(supabase, userId)) !== "business") redirect("/dashboard/feed");

  const now = requestTime();
  const locale = await getCurrentLocale();
  const [activity, settings, knowledge, usage, connection, { data: profile }] = await Promise.all([
    loadMyAgentActivity(supabase, userId, locale),
    loadMyAgentSettings(supabase, userId),
    loadMyAgentKnowledge(supabase, userId),
    loadMyAgentUsage(supabase, userId, now, locale),
    loadWhatsAppConnection(supabase, userId),
    supabase.from("profiles").select("username, display_name").eq("id", userId).maybeSingle(),
  ]);
  const conversations = await loadMyAgentConversations(supabase, userId, settings.takeoverMinutes, now);
  const businessName = profile?.display_name?.trim() || profile?.username || null;

  return (
    <PageShell width="content">
      <MyAgentWorkspace
        initialTab={initialTab}
        now={now}
        activity={activity}
        conversations={conversations}
        usage={usage}
        connection={connection}
        settings={settings}
        knowledge={knowledge}
        businessName={businessName}
      />
    </PageShell>
  );
}
