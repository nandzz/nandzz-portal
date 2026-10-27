import { redirect } from "next/navigation";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";
import { PageShell } from "@/components/layout/PageShell";
import { WhatsAppChannel } from "../components/WhatsAppChannel";
import { loadWhatsAppConnection } from "../server/load-conversations";

// Channels → WhatsApp: connect the business's own number (Coexistence).
// Rendered by `app/dashboard/my-agent/channels/whatsapp` (dev builds only).
// Real connection status; connecting waits for Meta Embedded Signup.
export async function WhatsAppChannelPage() {
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
