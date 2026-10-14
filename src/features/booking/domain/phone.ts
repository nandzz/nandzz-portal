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

// IANA timezone → region for the countries in PHONE_COUNTRIES. The timezone
// reflects where the visitor physically is (an en-GB browser in Rome reports
// Europe/Rome), so it beats the language tag as a phone-country signal.
// Only the main zones per country — unlisted zones fall through to language.
const TZ_REGION: Record<string, string> = {
  // North America
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US",
  "America/Detroit": "US", "America/Boise": "US", "America/Indiana/Indianapolis": "US",
  "America/Kentucky/Louisville": "US", "Pacific/Honolulu": "US",
  "America/Toronto": "CA", "America/Montreal": "CA", "America/Vancouver": "CA",
  "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA",
  "America/St_Johns": "CA", "America/Regina": "CA",
  // Europe
  "Europe/London": "GB", "Europe/Belfast": "GB", "Europe/Dublin": "IE",
  "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Rome": "IT",
  "Europe/Madrid": "ES", "Atlantic/Canary": "ES", "Africa/Ceuta": "ES",
  "Europe/Lisbon": "PT", "Atlantic/Madeira": "PT", "Atlantic/Azores": "PT",
  "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Luxembourg": "LU",
  "Europe/Zurich": "CH", "Europe/Vienna": "AT", "Europe/Copenhagen": "DK",
  "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Helsinki": "FI",
  "Atlantic/Reykjavik": "IS", "Europe/Warsaw": "PL", "Europe/Prague": "CZ",
  "Europe/Bratislava": "SK", "Europe/Budapest": "HU", "Europe/Bucharest": "RO",
  "Europe/Sofia": "BG", "Europe/Athens": "GR", "Europe/Zagreb": "HR",
  "Europe/Ljubljana": "SI", "Europe/Belgrade": "RS", "Europe/Kiev": "UA",
  "Europe/Kyiv": "UA", "Europe/Moscow": "RU", "Europe/Istanbul": "TR",
  "Asia/Istanbul": "TR",
  // Latin America
  "America/Sao_Paulo": "BR", "America/Fortaleza": "BR", "America/Recife": "BR",
  "America/Bahia": "BR", "America/Belem": "BR", "America/Manaus": "BR",
  "America/Mexico_City": "MX", "America/Cancun": "MX", "America/Monterrey": "MX",
  "America/Tijuana": "MX", "America/Merida": "MX", "America/Chihuahua": "MX",
  "America/Hermosillo": "MX", "America/Mazatlan": "MX",
  "America/Argentina/Buenos_Aires": "AR", "America/Buenos_Aires": "AR",
  "America/Argentina/Cordoba": "AR", "America/Santiago": "CL", "America/Bogota": "CO",
  "America/Lima": "PE", "America/Montevideo": "UY", "America/Asuncion": "PY",
  "America/La_Paz": "BO", "America/Guayaquil": "EC", "America/Caracas": "VE",
  "America/Costa_Rica": "CR", "America/Panama": "PA", "America/Guatemala": "GT",
  "America/Santo_Domingo": "DO",
  // Oceania
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU",
  "Australia/Perth": "AU", "Australia/Adelaide": "AU", "Australia/Hobart": "AU",
  "Australia/Darwin": "AU", "Pacific/Auckland": "NZ",
  // Asia
  "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Shanghai": "CN", "Asia/Chongqing": "CN",
  "Asia/Urumqi": "CN", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW",
  "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY", "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN", "Asia/Saigon": "VN", "Asia/Manila": "PH",
  "Asia/Jakarta": "ID", "Asia/Makassar": "ID", "Asia/Jayapura": "ID",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD", "Asia/Colombo": "LK", "Asia/Dubai": "AE", "Asia/Riyadh": "SA",
  "Asia/Qatar": "QA", "Asia/Kuwait": "KW", "Asia/Bahrain": "BH", "Asia/Muscat": "OM",
  "Asia/Jerusalem": "IL", "Asia/Tel_Aviv": "IL", "Asia/Amman": "JO", "Asia/Beirut": "LB",
  // Africa
  "Africa/Cairo": "EG", "Africa/Casablanca": "MA", "Africa/Tunis": "TN",
  "Africa/Algiers": "DZ", "Africa/Johannesburg": "ZA", "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE", "Africa/Accra": "GH", "Africa/Addis_Ababa": "ET",
  "Africa/Dar_es_Salaam": "TZ",
};

function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

// Infer the visitor's phone country. Order: the browser TIMEZONE (where they
// actually are — an English-UI browser in Italy still reports Europe/Rome),
// then the language tag the same way locale is inferred: `Intl.Locale.maximize()`
// adds CLDR's likely region even for a bare language ("pt" → "pt-Latn-BR"),
// trying the raw browser tag first, then the resolved locale, then "US".
// Client-only in practice (the server's timezone is meaningless here).
export function inferPhoneRegion(
  navLang: string | undefined | null,
  fallbackLocale: string,
  timeZone: string | null = browserTimeZone()
): string {
  const tzRegion = timeZone ? TZ_REGION[timeZone] : undefined;
  if (tzRegion && KNOWN_REGIONS.has(tzRegion)) return tzRegion;
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
