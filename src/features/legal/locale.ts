import type { Locale } from "@/lib/i18n/translations";

// Legal documents are published in English and Italian only. Every other app
// locale reads the English text (the Italian version prevails for consumers
// resident in Italy — stated on each page).
export type LegalLocale = "en" | "it";

export function toLegalLocale(locale: Locale | string | null | undefined): LegalLocale {
  return locale === "it" ? "it" : "en";
}

const DATE_LOCALE: Record<LegalLocale, string> = { en: "en-GB", it: "it-IT" };

export function formatLegalDate(isoDate: string, locale: LegalLocale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
