// The username a visitor picked in the "claim your page" sheet, carried across
// signup (email confirmation and the Google round trip included) so the
// choose-a-username step arrives pre-filled. localStorage, not sessionStorage:
// the email-confirmation link may open in a new tab. Best-effort throughout —
// storage can be blocked, and the step still works empty.
const KEY = "nandzz:pending-username";

export function savePendingUsername(username: string) {
  try {
    localStorage.setItem(KEY, username);
  } catch {
    // ignore
  }
}

export function readPendingUsername(): string {
  try {
    const v = localStorage.getItem(KEY) ?? "";
    return /^[a-z0-9_-]{3,30}$/.test(v) ? v : "";
  } catch {
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
