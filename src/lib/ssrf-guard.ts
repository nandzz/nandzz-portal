import { promises as dns } from "node:dns";
import net from "node:net";

// Blocks SSRF against internal infrastructure (the Amplify/Lambda host, the
// AWS instance-metadata service, other services on the private network) when
// a route fetches a URL supplied by the caller. Node's `fetch` does not
// filter destinations on its own, so any route that proxies an
// attacker-controlled URL needs this check before calling fetch().

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed — fail closed
  }
  const [a, b] = parts;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local — includes 169.254.169.254 (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === "::1" || norm === "::") return true;
  if (norm.startsWith("fe80:")) return true; // link-local
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // unique local fc00::/7
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded v4 address too.
  const mapped = norm.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped && net.isIP(mapped[1])) return isPrivateIPv4(mapped[1]);
  return false;
}

/**
 * Returns true only if `rawUrl` is http(s) and every address it resolves to
 * is a public, routable IP. Used to gate server-side fetches of
 * user/attacker-supplied URLs (og:image scraping, screenshot proxies, etc.)
 *
 * Not a complete defense against DNS-rebinding (the IP can change between
 * this check and the actual fetch) — it raises the bar against the common
 * case of pointing the fetch straight at a private/metadata address.
 */
export async function isPublicHttpUrl(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const hostname = url.hostname;
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) return false;

  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) return !isPrivateIPv4(hostname);
  if (ipVersion === 6) return !isPrivateIPv6(hostname);

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return false;
    for (const rec of records) {
      if (rec.family === 4 && isPrivateIPv4(rec.address)) return false;
      if (rec.family === 6 && isPrivateIPv6(rec.address)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
