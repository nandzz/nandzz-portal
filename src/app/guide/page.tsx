import type { Metadata } from "next";
import { GUIDE_COPY, GuidePage, toGuideLocale } from "@/features/guide";
import { getCurrentLocale } from "@/lib/i18n/server";

async function getCopy() {
  return GUIDE_COPY[toGuideLocale(await getCurrentLocale())];
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy();
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: { canonical: "/guide" },
    openGraph: { title: copy.metaTitle, description: copy.metaDescription, type: "website" },
    twitter: { card: "summary", title: copy.metaTitle, description: copy.metaDescription },
  };
}

export default async function GuideRoute() {
  const copy = await getCopy();
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: copy.title,
    description: copy.subtitle,
    step: copy.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.body,
      url: `https://nandzz.com/guide#${s.id}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo) }} />
      <GuidePage copy={copy} />
    </>
  );
}
