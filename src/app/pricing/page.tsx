import type { Metadata } from "next";
import { getPublicPricing } from "@/lib/pricing";
import { PricingClient } from "./PricingClient";
import { pricingFaqs } from "./faqs";
import type { SubscriptionPlan } from "@/lib/types";
import { getServerTranslations } from "@/lib/i18n/server";

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

export default async function PricingPage() {
  const { plans } = await getPublicPricing();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pricingFaqs.map((item) => ({
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
        faqs={pricingFaqs}
      />
    </>
  );
}
