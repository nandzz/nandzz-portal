import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ChromeProvider } from "@/contexts/ChromeContext";
import { Navbar } from "@/components/layout/Navbar";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { type Locale, SUPPORTED_LOCALES, detectLocale } from "@/lib/i18n/translations";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
    default: "Nandzz — Share what you create.",
    template: "%s — Nandzz",
  },
  description:
    "Nandzz — Share what you create. A gallery for web pages, PDFs, tools, and interactive AI creations.",
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
    locale: "en_US",
    url: "https://nandzz.com",
    siteName: "Nandzz",
    title: "Nandzz — Share what you create.",
    description:
      "A gallery for web pages, PDFs, tools, and interactive AI creations.",
    images: [{ url: "/logo.png", alt: "Nandzz" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nandzz — Share what you create.",
    description:
      "A gallery for web pages, PDFs, tools, and interactive AI creations.",
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

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawLang = cookieStore.get("nandzz-lang")?.value;

  let initialLocale: Locale;
  if (rawLang && SUPPORTED_LOCALES.includes(rawLang as Locale)) {
    initialLocale = rawLang as Locale;
  } else {
    // First visit: no cookie yet — detect from the Accept-Language request header
    const headersList = await headers();
    const acceptLang = headersList.get("accept-language") ?? "en";
    initialLocale = detectLocale(acceptLang);
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
              <Navbar />
              <main className="flex-1 pb-16 md:pb-0">{children}</main>
              <ConditionalFooter />
              <MobileTabBar />
            </ChromeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
