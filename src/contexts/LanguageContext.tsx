"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type Locale,
  type Translations,
  SUPPORTED_LOCALES,
  detectLocale,
} from "@/lib/i18n/translations";
import { en } from "@/lib/i18n/locales/en";

const COOKIE_NAME = "nandzz-lang";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// One chunk per language, so a visitor downloads only the one they read: the
// server hands the initial one in, and switching fetches the next on demand.
// English is bundled as the fallback (and the context default).
const LOADERS: Record<Locale, () => Promise<Translations>> = {
  en: async () => en,
  pt: () => import("@/lib/i18n/locales/pt").then((m) => m.pt),
  fr: () => import("@/lib/i18n/locales/fr").then((m) => m.fr),
  es: () => import("@/lib/i18n/locales/es").then((m) => m.es),
  ja: () => import("@/lib/i18n/locales/ja").then((m) => m.ja),
  de: () => import("@/lib/i18n/locales/de").then((m) => m.de),
  it: () => import("@/lib/i18n/locales/it").then((m) => m.it),
};

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
  t: en,
});

export function LanguageProvider({
  children,
  initialLocale,
  initialTranslations,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
  /** The dictionary for `initialLocale`; omit only for English. */
  initialTranslations?: Translations;
}) {
  const [state, setState] = useState<{ locale: Locale; t: Translations }>({
    locale: initialLocale,
    t: initialTranslations ?? en,
  });

  // Locale and strings change together once the dictionary has arrived. Only
  // the latest request lands, so a quick double switch can't end on the first.
  const wanted = useRef<Locale>(state.locale);
  const load = useCallback((lang: Locale, onLoaded?: () => void) => {
    wanted.current = lang;
    LOADERS[lang]()
      .then((t) => {
        if (wanted.current !== lang) return;
        setState({ locale: lang, t });
        onLoaded?.();
      })
      // Chunk failed to load (offline, stale deploy): keep the current language.
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cookieLang = readLangCookie();
    if (cookieLang && cookieLang !== state.locale) {
      load(cookieLang);
      return;
    }
    if (!cookieLang) {
      const browserLang = detectLocale(navigator.language);
      if (browserLang !== state.locale) load(browserLang);
      writeLangCookie(browserLang);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((lang: Locale) => {
    writeLangCookie(lang);
    load(lang, () => {
      // Update the HTML lang attribute
      document.documentElement.lang = lang;
    });
  }, [load]);

  return (
    <LanguageContext.Provider value={{ locale: state.locale, setLocale, t: state.t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
