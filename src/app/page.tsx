import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerTranslations } from "@/lib/i18n/server";
import { getPublicPricing } from "@/lib/pricing";
import { HomeClient } from "./HomeClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslations();
  return {
    title: t.meta.rootTitle,
    description: t.meta.rootDescription,
    alternates: {
      canonical: "https://nandzz.com",
    },
  };
}

export default async function HomePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    redirect(profile?.username ? `/${profile.username}` : "/dashboard/contents");
  }

  const [t, { plans }] = await Promise.all([
    getServerTranslations(),
    getPublicPricing(),
  ]);

  // Offers are built from the live plan catalog so structured data never drifts
  // from what /pricing actually charges.
  const offers = plans.map((plan) => ({
    "@type": "Offer",
    name: plan.name,
    price: (plan.price_cents / 100).toString(),
    priceCurrency: (plan.currency || "eur").toUpperCase(),
    ...(plan.description ? { description: plan.description } : {}),
  }));

  const websiteSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://nandzz.com/#website",
        url: "https://nandzz.com",
        name: "nandzz",
        description:
          "A social platform that connects businesses and their clients — a branded page with booking, content and links.",
      },
      {
        "@type": "Organization",
        "@id": "https://nandzz.com/#organization",
        name: "nandzz",
        url: "https://nandzz.com",
        description:
          "Nandzz is a social platform that connects businesses and their clients: a branded link-in-bio page where clients follow you, see your content and links, and book in a tap.",
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://nandzz.com/#app",
        name: "nandzz",
        applicationCategory: "WebApplication",
        operatingSystem: "Web",
        ...(offers.length > 0 ? { offers } : {}),
      },
      {
        "@type": "FAQPage",
        "@id": "https://nandzz.com/#faq",
        mainEntity: t.home.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <HomeClient />
    </>
  );
}
