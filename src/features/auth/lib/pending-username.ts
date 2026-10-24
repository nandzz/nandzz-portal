// The username a visitor picked in the "claim your page" sheet, carried across
// signup (email confirmation and the Google round trip included) so the
// choose-a-username step arrives pre-filled. localStorage, not sessionStorage:
// the email-confirmation link may open in a new tab. Best-effort throughout —
// storage can be blocked, and the step still works empty.
// Stored with a timestamp and dropped after a day, so a name claimed in some
// earlier, abandoned visit doesn't haunt later signups on the same browser.
const KEY = "nandzz:pending-username";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function savePendingUsername(username: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ username, at: Date.now() }));
  } catch {
    // ignore
  }
}

export function readPendingUsername(): string {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return "";
    // Legacy entries were a bare string with no timestamp: treat as expired.
    const parsed: unknown = JSON.parse(raw);
    const { username, at } = (parsed ?? {}) as { username?: unknown; at?: unknown };
    const fresh = typeof at === "number" && Date.now() - at < MAX_AGE_MS;
    if (fresh && typeof username === "string" && /^[a-z0-9_-]{3,30}$/.test(username)) return username;
    localStorage.removeItem(KEY);
    return "";
  } catch {
    clearPendingUsername();
    return "";
  }
}

export function clearPendingUsername() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
