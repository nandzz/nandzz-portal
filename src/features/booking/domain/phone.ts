// Lightweight phone-number helpers for the public booking widget — no external
// dependency (the repo carries no libphonenumber). We keep a curated ISO
// region → calling-code table, derive flags from the region code itself
// (regional-indicator codepoints), and localize country names at render via
// `Intl.DisplayNames`, so this table only stores the two facts Intl can't give
// us: the region and its dial code.

export type PhoneCountry = { region: string; dial: string };

// Common calling codes covering the widget's supported locales plus the major
// international markets. Not exhaustive — enough that most visitors find their
// country, with the inferred default handling the common case anyway. Shared
// dial codes (e.g. +1 US/CA, +44 GB) resolve to the first match when splitting.
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { region: "US", dial: "1" },
  { region: "CA", dial: "1" },
  { region: "GB", dial: "44" },
  { region: "IE", dial: "353" },
  { region: "FR", dial: "33" },
  { region: "DE", dial: "49" },
  { region: "IT", dial: "39" },
  { region: "ES", dial: "34" },
  { region: "PT", dial: "351" },
  { region: "NL", dial: "31" },
  { region: "BE", dial: "32" },
  { region: "LU", dial: "352" },
  { region: "CH", dial: "41" },
  { region: "AT", dial: "43" },
  { region: "DK", dial: "45" },
  { region: "SE", dial: "46" },
  { region: "NO", dial: "47" },
  { region: "FI", dial: "358" },
  { region: "IS", dial: "354" },
  { region: "PL", dial: "48" },
  { region: "CZ", dial: "420" },
  { region: "SK", dial: "421" },
  { region: "HU", dial: "36" },
  { region: "RO", dial: "40" },
  { region: "BG", dial: "359" },
  { region: "GR", dial: "30" },
  { region: "HR", dial: "385" },
  { region: "SI", dial: "386" },
  { region: "RS", dial: "381" },
  { region: "UA", dial: "380" },
  { region: "RU", dial: "7" },
  { region: "TR", dial: "90" },
  { region: "BR", dial: "55" },
  { region: "MX", dial: "52" },
  { region: "AR", dial: "54" },
  { region: "CL", dial: "56" },
  { region: "CO", dial: "57" },
  { region: "PE", dial: "51" },
  { region: "UY", dial: "598" },
  { region: "PY", dial: "595" },
  { region: "BO", dial: "591" },
  { region: "EC", dial: "593" },
  { region: "VE", dial: "58" },
  { region: "CR", dial: "506" },
  { region: "PA", dial: "507" },
  { region: "GT", dial: "502" },
  { region: "DO", dial: "1" },
  { region: "AU", dial: "61" },
  { region: "NZ", dial: "64" },
  { region: "JP", dial: "81" },
  { region: "KR", dial: "82" },
  { region: "CN", dial: "86" },
  { region: "HK", dial: "852" },
  { region: "TW", dial: "886" },
  { region: "SG", dial: "65" },
  { region: "MY", dial: "60" },
  { region: "TH", dial: "66" },
  { region: "VN", dial: "84" },
  { region: "PH", dial: "63" },
  { region: "ID", dial: "62" },
  { region: "IN", dial: "91" },
  { region: "PK", dial: "92" },
  { region: "BD", dial: "880" },
  { region: "LK", dial: "94" },
  { region: "AE", dial: "971" },
  { region: "SA", dial: "966" },
  { region: "QA", dial: "974" },
  { region: "KW", dial: "965" },
  { region: "BH", dial: "973" },
  { region: "OM", dial: "968" },
  { region: "IL", dial: "972" },
  { region: "JO", dial: "962" },
  { region: "LB", dial: "961" },
  { region: "EG", dial: "20" },
  { region: "MA", dial: "212" },
  { region: "TN", dial: "216" },
  { region: "DZ", dial: "213" },
  { region: "ZA", dial: "27" },
  { region: "NG", dial: "234" },
  { region: "KE", dial: "254" },
  { region: "GH", dial: "233" },
  { region: "ET", dial: "251" },
  { region: "TZ", dial: "255" },
];

// Regional-indicator flag emoji for an ISO 3166-1 alpha-2 region code (e.g.
// "US" → 🇺🇸). Each letter maps to its regional-indicator symbol codepoint.
export function regionToFlag(region: string): string {
  return region
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

// Best-effort country name in the given locale, falling back to the region code
// itself if the runtime lacks the data.
export function regionName(region: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(region) ?? region;
  } catch {
    return region;
  }
}

const KNOWN_REGIONS = new Set(PHONE_COUNTRIES.map((c) => c.region));

// Infer the phone country the SAME way locale is inferred: from the visitor's
// language tag. `Intl.Locale.maximize()` adds CLDR's likely region even for a
// bare language ("pt" → "pt-Latn-BR", "en" → "en-Latn-US"), so we get a sane
// default without geo-IP. Tries the raw browser tag first, then the resolved
// locale, then falls back to "US".
export function inferPhoneRegion(
  navLang: string | undefined | null,
  fallbackLocale: string
): string {
  for (const tag of [navLang, fallbackLocale]) {
    if (!tag) continue;
    try {
      const loc = new Intl.Locale(tag);
      const region = loc.region ?? loc.maximize().region;
      if (region && KNOWN_REGIONS.has(region)) return region;
    } catch {
      // Malformed tag — try the next candidate.
    }
  }
  return "US";
}

export function dialForRegion(region: string): string {
  return PHONE_COUNTRIES.find((c) => c.region === region)?.dial ?? "1";
}

// A syntactic email check — deliberately permissive (one @, a dot in the
// domain, no spaces). Real validity is confirmed by the confirmation email.
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Whether a national number is plausibly dialable. We don't do per-country
// length rules (no library): just that, once non-digits are stripped, it's the
// 4–14 digits E.164 allows after the country code.
export function isPossiblePhoneNumber(national: string): boolean {
  const digits = national.replace(/\D/g, "");
  return digits.length >= 4 && digits.length <= 14;
}

// Combine a dial code + national number into an E.164 string (`+<dial><digits>`).
export function toE164(dial: string, national: string): string {
  return `+${dial}${national.replace(/\D/g, "")}`;
}

// Split an E.164 string back into a known region + national part, matching the
// longest dial code first so "+3519..." picks PT (351) over a bare 3. Falls
// back to the raw digits under "US" when nothing matches.
export function splitE164(e164: string): { region: string; national: string } {
  const digits = e164.replace(/[^\d]/g, "");
  const byLen = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of byLen) {
    if (digits.startsWith(c.dial)) {
      return { region: c.region, national: digits.slice(c.dial.length) };
    }
  }
  return { region: "US", national: digits };
}
