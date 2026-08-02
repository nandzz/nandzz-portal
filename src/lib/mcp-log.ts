// Sanitize a value before interpolating into a log line. Strips CR/LF and
// other control chars so an attacker can't inject fake log entries by
// smuggling newlines through headers/body fields.
export function safe(v: unknown, maxLen = 200): string {
  if (v == null) return "none";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  const clean = s.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}…` : clean;
}
