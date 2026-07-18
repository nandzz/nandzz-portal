import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PricingClient } from "./PricingClient";
import type { CreditPack } from "@/lib/types";
import { getCreditsConfig } from "@/lib/credits-config";

// Built from the live signup grant so the SEO copy doesn't drift from the
// admin-configured value.
export async function generateMetadata(): Promise<Metadata> {
  const { signupGrant } = await getCreditsConfig();
  const desc = `Pay as you go. ${signupGrant} free space credits on signup. Buy more whenever you need them — credits never expire.`;
  const shortDesc = `Pay as you go. ${signupGrant} free credits on signup. Buy more anytime.`;
  return {
    title: "Credits — Nandzz",
    description: desc,
    openGraph: {
      title: "Credits — Nandzz",
      description: shortDesc,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Credits — Nandzz",
      description: shortDesc,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const supabase = await createClient();
  const [{ data: packs }, creditsConfig] = await Promise.all([
    supabase
      .from("credit_packs")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    getCreditsConfig(),
  ]);

  return (
    <PricingClient
      packs={(packs ?? []) as CreditPack[]}
      publishCost={creditsConfig.publishCost}
      signupGrant={creditsConfig.signupGrant}
    />
  );
}
