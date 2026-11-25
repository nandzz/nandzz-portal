// Money is integer cents + a lowercase ISO currency code everywhere
// (orders_foundation.sql). Formatting is locale-aware; parsing accepts what
// owners type ("12", "12.5", "12,50", "1.250,00", "€ 4,90").

export function formatMoney(cents: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

const MAX_CENTS = 100_000_000; // products.price_cents check

/** Owner-typed price → cents, or null when it isn't a valid amount. */
export function parseMoneyInput(raw: string): number | null {
  const s = raw.replace(/[^\d.,]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  // A separator followed by 1–2 digits at the end is the decimal mark;
  // anything else ("1.250" / "1,250") is a thousands separator.
  const decimals = lastSep >= 0 ? s.length - lastSep - 1 : 0;
  let whole: string;
  let frac = "";
  if (lastSep >= 0 && decimals >= 1 && decimals <= 2) {
    whole = s.slice(0, lastSep);
    frac = s.slice(lastSep + 1);
  } else {
    whole = s;
  }
  whole = whole.replace(/[.,]/g, "");
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(frac)) return null;
  const cents = Number(whole || "0") * 100 + Number(frac.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null;
  return cents;
}

/** Cents → the plain editable form ("12.50"), no currency symbol. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
