export function isLikelyValidHtml(html: string): { ok: boolean; reason?: string } {
  const s = html.trim();
  if (!s.includes("<html")) return { ok: false, reason: "missing <html" };
  if (!s.includes("</html>")) return { ok: false, reason: "missing </html>" };
  if (!s.includes("<body")) return { ok: false, reason: "missing <body" };
  // Guard against clearly truncated output
  if (s.length < 50) return { ok: false, reason: "too short" };
  return { ok: true };
}
