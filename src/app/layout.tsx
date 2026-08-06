import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ChromeProvider } from "@/contexts/ChromeContext";
import { AppChrome } from "@/components/layout/AppChrome";
import { type Locale } from "@/lib/i18n/translations";
import { getServerTranslations, getCurrentLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { ProfileLite } from "@/lib/types";
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
      "share web apps",
      "your gallery",
      "web app community",
      "HTML app hosting",
      "interactive page sharing",
      "AI generated apps",
      "creative coding gallery",
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

  let initialProfile: ProfileLite | null = null;
  if (initialUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", initialUserId)
      .single();
    if (data) initialProfile = data;
  }

  return (
    <html
      lang={initialLocale}
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider initialLocale={initialLocale}>
            <ChromeProvider>
              <AppChrome initialUserId={initialUserId} initialProfile={initialProfile}>
                {children}
              </AppChrome>
            </ChromeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
