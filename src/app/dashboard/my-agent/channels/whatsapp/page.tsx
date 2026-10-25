export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";
import { FEATURES } from "@/lib/flags";
import { PageShell } from "@/components/layout/PageShell";
import { WhatsAppChannel } from "@/features/my-agent";

// Channels → WhatsApp: connect the business's own number (Coexistence).
// Placeholder flow until Embedded Signup and the webhook receiver exist.
export default async function WhatsAppChannelPage() {
  if (!FEATURES.businessAgent) notFound();

  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login");
  if ((await getAccountType(supabase, userId)) !== "business") redirect("/dashboard/feed");

  return (
    <PageShell width="content">
      <WhatsAppChannel />
    </PageShell>
  );
}
