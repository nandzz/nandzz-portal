export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";
import { FEATURES } from "@/lib/flags";
import { PageShell } from "@/components/layout/PageShell";
import { WhatsAppChannel } from "@/features/my-agent";
import { loadWhatsAppConnection } from "@/features/my-agent/server/load-conversations";

// Channels → WhatsApp: connect the business's own number (Coexistence).
// Real connection status; connecting waits for Meta Embedded Signup.
export default async function WhatsAppChannelPage() {
  if (!FEATURES.businessAgent) notFound();

  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login");
  if ((await getAccountType(supabase, userId)) !== "business") redirect("/dashboard/feed");

  return (
    <PageShell width="content">
      <WhatsAppChannel connection={await loadWhatsAppConnection(supabase, userId)} />
    </PageShell>
  );
}
