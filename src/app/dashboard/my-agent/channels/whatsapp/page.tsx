export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

// Dev-only, see ../../[[...section]]/page.tsx for why the import is dynamic.
export default async function Page() {
  if (process.env.BUSINESS_AGENT_ENABLED === "1") {
    const { WhatsAppChannelPage } = await import("@/features/my-agent/pages/WhatsAppChannelPage");
    return WhatsAppChannelPage();
  }
  notFound();
}
