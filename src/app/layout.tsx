import type { Metadata, Viewport } from "next";
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
import type { Profile } from "@/lib/types";
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
      "booking widget",
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

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

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
  if (initialUserId) {
    initialProfile = await getChromeProfile(supabase, initialUserId);
  }

  const initialFlags = await getFeatureFlags();

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
              <AuthProvider initialUserId={initialUserId} initialProfile={initialProfile} initialFlags={initialFlags}>
                <AppChrome>{children}</AppChrome>
              </AuthProvider>
            </ChromeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
