"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type Locale,
  type Translations,
  SUPPORTED_LOCALES,
  detectLocale,
  getTranslations,
} from "@/lib/i18n/translations";

const COOKIE_NAME = "nandzz-lang";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readLangCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((r) => r.startsWith(COOKIE_NAME + "="));
  const val = match?.split("=")[1];
  return val && SUPPORTED_LOCALES.includes(val as Locale) ? (val as Locale) : null;
}

function writeLangCookie(lang: Locale) {
  document.cookie = `${COOKIE_NAME}=${lang}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
};

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  setLocale: () => {},
  t: getTranslations("en"),
});

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const cookieLang = readLangCookie();
    if (cookieLang && cookieLang !== locale) {
      setLocaleState(cookieLang);
      return;
    }
    if (!cookieLang) {
      const browserLang = detectLocale(navigator.language);
      setLocaleState(browserLang);
      writeLangCookie(browserLang);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((lang: Locale) => {
    setLocaleState(lang);
    writeLangCookie(lang);
    // Update the HTML lang attribute
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, []);

  return (
    <LanguageContext.Provider
      value={{ locale, setLocale, t: getTranslations(locale) }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
