// Social link values are stored as a bare handle ("mario.salon") or, when a
// handle can't express it (LinkedIn company page, YouTube /channel/…), a full
// URL ON THAT PLATFORM. Shared by the editor (normalize on paste/blur/save),
// the server action (validate) and the renderer (build hrefs) so they agree.

export type SocialPlatform = "instagram" | "linkedin" | "twitter" | "github" | "youtube";

const HOSTS: Record<SocialPlatform, string[]> = {
  instagram: ["instagram.com"],
  linkedin: ["linkedin.com"],
  twitter: ["x.com", "twitter.com"],
  github: ["github.com"],
  youtube: ["youtube.com", "youtu.be"],
};

const HANDLE_RE = /^[A-Za-z0-9._-]{1,100}$/;
export const SOCIAL_VALUE_MAX = 300;

function parseUrl(value: string): URL | null {
  const v = value.trim();
  if (!v) return null;
  try {
    return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
}

/** True when `value` is an http(s) URL whose host belongs to `platform`. */
export function isPlatformUrl(platform: SocialPlatform, value: string): boolean {
  if (!/^https?:\/\//i.test(value.trim())) return false;
  const url = parseUrl(value);
  if (!url || !/^https?:$/.test(url.protocol)) return false;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, "");
  return HOSTS[platform].includes(host);
}

/**
 * Turns whatever the owner typed/pasted into the stored form: a pasted profile
 * URL becomes its handle (so it fits and renders through our base URL), a
 * leading "@" is dropped, and URLs a handle can't represent are kept as a full
 * https URL. Text that is neither stays as typed (the server rejects it).
 */
export function normalizeSocialValue(platform: SocialPlatform, raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const looksLikeUrl = /^https?:\/\//i.test(v) || HOSTS[platform].some((h) => v.toLowerCase().replace(/^www\./, "").startsWith(`${h}/`));
  if (!looksLikeUrl) return v.replace(/^@/, "");

  const url = parseUrl(v);
  if (!url) return v;
  const full = `https://${url.hostname}${url.pathname}`.replace(/\/+$/, "");
  if (!isPlatformUrl(platform, full)) return v;
  const segs = url.pathname.split("/").filter(Boolean);

  let handle: string | undefined;
  if (platform === "linkedin") handle = segs[0] === "in" ? segs[1] : undefined;
  else if (platform === "youtube") handle = segs[0]?.startsWith("@") ? segs[0].slice(1) : undefined;
  else handle = segs.length === 1 ? segs[0] : undefined;

  if (handle && HANDLE_RE.test(handle)) return handle;
  return full;
}

/** Server-side check for a stored social value ("" clears it). */
export function isValidSocialValue(platform: SocialPlatform, value: string): boolean {
  if (value === "") return true;
  if (value.length > SOCIAL_VALUE_MAX) return false;
  return HANDLE_RE.test(value) || isPlatformUrl(platform, value);
}

/** https URL to a website, adding the scheme when the owner typed "mysite.com". */
export function normalizeWebsiteUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function isValidWebsiteUrl(value: string): boolean {
  const url = /^https?:\/\//i.test(value) ? parseUrl(value) : null;
  return !!url && url.hostname.includes(".");
}
