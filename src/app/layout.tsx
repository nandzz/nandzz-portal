import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeColorSync } from "@/components/theme-color-sync";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ChromeProvider } from "@/contexts/ChromeContext";
import { AppChrome } from "@/components/layout/AppChrome";
import { AuthProvider } from "@/features/auth/AuthContext";
import { type Locale } from "@/lib/i18n/translations";
import { getServerTranslations, getCurrentLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getChromeProfile } from "@/features/analytics/server";
import { getFeatureFlags } from "@/lib/featureFlags";
import { getEntitlementsForSlug } from "@/lib/plan";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/layout/appShell";
import { cookies } from "next/headers";
import { TermsUpdateBanner } from "@/features/legal";
import { getTermsAcceptanceStatus } from "@/features/legal/server";
import type { PlanEntitlements, Profile } from "@/lib/types";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  pt: "pt_BR",
  fr: "fr_FR",
  es: "es_ES",
  ja: "ja_JP",
  de: "de_DE",
  it: "it_IT",
};

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getServerTranslations(), getCurrentLocale()]);
  return {
    metadataBase: new URL("https://nandzz.com"),
    icons: {
      icon: [
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon.ico" },
      ],
      apple: [{ url: "/apple-touch-icon.png" }],
      other: [
        { rel: "manifest", url: "/site.webmanifest" },
      ],
    },
    title: {
      default: t.meta.rootTitle,
      template: t.meta.rootTitleTemplate,
    },
    description: t.meta.rootDescription,
    keywords: [
      "branded business page",
      "online booking page",
      "book appointments online",
      "link in bio with booking",
      "get found and booked",
      "small business scheduling",
      "social platform for businesses",
    ],
    authors: [{ name: "nandzz" }],
    creator: "nandzz",
    openGraph: {
      type: "website",
      locale: OG_LOCALES[locale],
      url: "https://nandzz.com",
      siteName: "Nandzz",
      title: t.meta.rootTitle,
      description: t.meta.rootOgDescription,
      images: [{ url: "/logo.png", alt: "Nandzz" }],
    },
    twitter: {
      card: "summary_large_image",
      title: t.meta.rootTitle,
      description: t.meta.rootOgDescription,
      creator: "@nandzz",
      images: ["/logo.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLocale = await getCurrentLocale();

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const initialUserId = claimsData?.claims?.sub ?? null;

  let initialProfile: Profile | null = null;
  let initialEntitlements: PlanEntitlements | undefined;
  let needsTermsAcceptance = false;
  if (initialUserId) {
    const [profile, terms] = await Promise.all([
      getChromeProfile(supabase, initialUserId),
      getTermsAcceptanceStatus(supabase, initialUserId),
    ]);
    initialProfile = profile;
    initialEntitlements = await getEntitlementsForSlug(profile?.plan_slug);
    // Only users who finished signup (have a profile) are asked to re-accept;
    // mid-signup users accept when they claim their username.
    needsTermsAcceptance = !!profile && terms.needsAcceptance;
  }

  const initialFlags = await getFeatureFlags();
  const initialSidebarCollapsed = (await cookies()).get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";

  return (
    <html
      lang={initialLocale}
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeColorSync />
          <LanguageProvider initialLocale={initialLocale}>
            <ChromeProvider>
              <AuthProvider
                initialUserId={initialUserId}
                initialProfile={initialProfile}
                initialEntitlements={initialEntitlements}
                initialFlags={initialFlags}
              >
                <AppChrome initialCollapsed={initialSidebarCollapsed}>{children}</AppChrome>
                {needsTermsAcceptance && <TermsUpdateBanner />}
              </AuthProvider>
            </ChromeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
