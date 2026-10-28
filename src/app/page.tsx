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

  // getClaims() verifies the JWT locally — no /auth/v1/user round-trip on the
  // hottest public route (the proxy has already refreshed the session).
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
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
          "A link-in-bio page with online booking built in: one branded page for your links, content and bookings.",
      },
      {
        "@type": "Organization",
        "@id": "https://nandzz.com/#organization",
        name: "nandzz",
        url: "https://nandzz.com",
        description:
          "Nandzz is a link-in-bio page with online booking built in. Each business gets one branded page for its links, content and services, where clients book in a tap, 24/7.",
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://nandzz.com/#app",
        name: "nandzz",
        applicationCategory: "BusinessApplication",
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
