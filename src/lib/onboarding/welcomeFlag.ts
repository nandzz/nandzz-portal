// One-shot marker that a home-page signup just finished: set right before the
// full-page redirect to the new profile, consumed by the welcome dialog that
// asks whether the account is for a business. Booking signups (embedded auth)
// never set it — they're clients mid-booking and must not be interrupted.
const WELCOME_KEY = "nandzz:welcome-account-type";

export function markWelcomePending() {
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {}
}

/** Returns true once if a fresh signup is pending its welcome, and clears it. */
export function consumeWelcomePending(): boolean {
  try {
    if (localStorage.getItem(WELCOME_KEY) !== "1") return false;
    localStorage.removeItem(WELCOME_KEY);
    return true;
  } catch {
    return false;
  }
}
