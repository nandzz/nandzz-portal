import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomeClient } from "./HomeClient";

export const metadata: Metadata = {
  title: "Nandzz — Share what you create.",
  description:
    "Nandzz — Share what you create. A gallery for web pages, PDFs, tools, and interactive AI creations.",
  alternates: {
    canonical: "https://nandzz.com",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://nandzz.com/#website",
      url: "https://nandzz.com",
      name: "nandzz",
      description: "A gallery for web pages, PDFs, tools, and interactive AI creations.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://nandzz.com/explore",
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://nandzz.com/#organization",
      name: "nandzz",
      url: "https://nandzz.com",
      description:
        "Nandzz is a creative community where makers share web apps, interactive tools, and AI-generated creations.",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://nandzz.com/#app",
      name: "nandzz",
      applicationCategory: "WebApplication",
      operatingSystem: "Web",
      offers: [
        {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "USD",
          description: "5 Spaces, public sharing, community profile",
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "9",
          priceCurrency: "USD",
          description: "Unlimited Spaces, private spaces, Pro badge, HTML editor",
        },
      ],
    },
  ],
};

export default async function HomePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    redirect(profile?.username ? `/${profile.username}` : "/dashboard");
  }

  const { data: spaces } = await supabase
    .from("spaces")
    .select("*, profiles(username, display_name, avatar_url)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <HomeClient spaces={spaces} />
    </>
  );
}
