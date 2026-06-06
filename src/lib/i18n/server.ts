import "server-only";
import { cookies, headers } from "next/headers";
import {
  getTranslations,
  detectLocale,
  SUPPORTED_LOCALES,
  type Locale,
  type Translations,
} from "./translations";

export async function getServerTranslations(): Promise<Translations> {
  const cookieStore = await cookies();
  const rawLang = cookieStore.get("nandzz-lang")?.value;

  let locale: Locale;
  if (rawLang && SUPPORTED_LOCALES.includes(rawLang as Locale)) {
    locale = rawLang as Locale;
  } else {
    const headersList = await headers();
    const acceptLang = headersList.get("accept-language") ?? "en";
    locale = detectLocale(acceptLang);
  }

  return getTranslations(locale);
}
