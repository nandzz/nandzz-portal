import "server-only";
import { getCurrentLocale } from "@/lib/i18n/server";
import { toLegalLocale, type LegalLocale } from "./locale";

export { getTermsAcceptanceStatus } from "./data/terms-status";

// Resolves the document language: an explicit `?lang=en|it` (the switch link
// on every legal page, also shareable) wins over the visitor's app locale.
export async function resolveLegalLocale(
  searchParams: Promise<Record<string, string | string[] | undefined>>
): Promise<LegalLocale> {
  const { lang } = await searchParams;
  if (lang === "it" || lang === "en") return lang;
  return toLegalLocale(await getCurrentLocale());
}
