import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PricingClient } from "./PricingClient";
import type { CreditPack } from "@/lib/types";
import { getCreditsConfig } from "@/lib/credits-config";
import { getServerTranslations } from "@/lib/i18n/server";

// Built from the live signup grant so the SEO copy doesn't drift from the
// admin-configured value.
export async function generateMetadata(): Promise<Metadata> {
  const [{ signupGrant }, t] = await Promise.all([getCreditsConfig(), getServerTranslations()]);
  const desc = t.meta.pricingDescription.replace("{grant}", String(signupGrant));
  const shortDesc = t.meta.pricingShortDescription.replace("{grant}", String(signupGrant));
  return {
    title: t.meta.pricingTitle,
    description: desc,
    openGraph: {
      title: t.meta.pricingTitle,
      description: shortDesc,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: t.meta.pricingTitle,
      description: shortDesc,
    },
  };
}

export const revalidate = 300;

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
