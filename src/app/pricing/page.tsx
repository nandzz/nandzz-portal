import type { Metadata } from "next";
import { getPublicPricing } from "@/lib/pricing";
import { PricingClient } from "./PricingClient";
import { pricingFaqsFor } from "./faqs";
import type { CreditPack, SubscriptionPlan } from "@/lib/types";
import { getServerTranslations } from "@/lib/i18n/server";
import { getFeatureFlags } from "@/lib/featureFlags";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslations();
  return {
    title: t.meta.pricingTitle,
    description: t.meta.pricingDescription,
    alternates: { canonical: "/pricing" },
    openGraph: {
      title: t.meta.pricingTitle,
      description: t.meta.pricingShortDescription,
      type: "website",
      url: "/pricing",
    },
    twitter: {
      card: "summary",
      title: t.meta.pricingTitle,
      description: t.meta.pricingShortDescription,
    },
  };
}

export const revalidate = 300;

export default async function PricingPage() {
  const [{ plans, packs }, { ai: aiEnabled }] = await Promise.all([
    getPublicPricing(),
    getFeatureFlags(),
  ]);

  const faqs = pricingFaqsFor(aiEnabled);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <PricingClient
        plans={(plans ?? []) as SubscriptionPlan[]}
        packs={aiEnabled ? ((packs ?? []) as CreditPack[]) : []}
        faqs={faqs}
        aiEnabled={aiEnabled}
      />
    </>
  );
}
