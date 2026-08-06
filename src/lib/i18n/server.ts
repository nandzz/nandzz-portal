import "server-only";
import { cookies, headers } from "next/headers";
import {
  getTranslations,
  detectLocale,
  SUPPORTED_LOCALES,
  type Locale,
  type Translations,
} from "./translations";

export async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const rawLang = cookieStore.get("nandzz-lang")?.value;

  if (rawLang && SUPPORTED_LOCALES.includes(rawLang as Locale)) {
    return rawLang as Locale;
  }
  const headersList = await headers();
  const acceptLang = headersList.get("accept-language") ?? "en";
  return detectLocale(acceptLang);
}

export async function getServerTranslations(): Promise<Translations> {
  const locale = await getCurrentLocale();
  return getTranslations(locale);
}
