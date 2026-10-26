// Every language at once, for server code (and tests). Client code must not
// import this: LanguageContext loads one language at a time so the bundle
// doesn't carry all seven.
import { SUPPORTED_LOCALES, type Locale, type Translations } from "./translations";
import { en } from "./locales/en";
import { pt } from "./locales/pt";
import { fr } from "./locales/fr";
import { es } from "./locales/es";
import { ja } from "./locales/ja";
import { de } from "./locales/de";
import { it } from "./locales/it";

export const translations: Record<Locale, Translations> = { en, pt, fr, es, ja, de, it };

export function getTranslations(locale: string): Translations {
  const lang = SUPPORTED_LOCALES.includes(locale as Locale) ? (locale as Locale) : "en";
  return translations[lang];
}
