"use client";

import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/translations";

const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  pt: "🇧🇷",
  fr: "🇫🇷",
  es: "🇪🇸",
  ja: "🇯🇵",
  de: "🇩🇪",
  it: "🇮🇹",
};

// Compact language switcher — a real <select> so it works with the native
// mobile picker UI, unlike the full flag-grid on /dashboard/settings.
export function LocaleSelect({ className = "" }: { className?: string }) {
  const { t, locale, setLocale } = useLanguage();

  return (
    <label
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-emerald-300 hover:text-foreground ${className}`}
    >
      <Globe className="h-3.5 w-3.5 shrink-0" />
      <span className="sr-only">{t.settings.languageLabel}</span>
      <select
        aria-label={t.settings.languageLabel}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="cursor-pointer appearance-none bg-transparent pr-0.5 text-foreground focus:outline-none"
      >
        {SUPPORTED_LOCALES.map((lang) => (
          <option key={lang} value={lang} className="text-foreground">
            {LOCALE_FLAGS[lang]} {LOCALE_LABELS[lang]}
          </option>
        ))}
      </select>
    </label>
  );
}

// Discreet switcher for the public marketing pages (home, guide): just a globe
// and the language code, with the native picker over it. Server-rendered copy
// (e.g. the guide) only follows the cookie on a new render, so it refreshes.
export function LocaleQuickSwitch({ className = "" }: { className?: string }) {
  const { t, locale, setLocale } = useLanguage();
  const router = useRouter();

  return (
    <label
      className={`relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-within:ring-2 focus-within:ring-ring ${className}`}
    >
      <Globe aria-hidden className="h-3.5 w-3.5" />
      <span aria-hidden>{locale}</span>
      <select
        aria-label={t.settings.languageLabel}
        value={locale}
        onChange={(e) => {
          setLocale(e.target.value as Locale);
          router.refresh();
        }}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {SUPPORTED_LOCALES.map((lang) => (
          <option key={lang} value={lang}>
            {LOCALE_FLAGS[lang]} {LOCALE_LABELS[lang]}
          </option>
        ))}
      </select>
    </label>
  );
}
