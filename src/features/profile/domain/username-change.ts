// Users may change their username USERNAME_CHANGE_LIMIT times in any rolling
// USERNAME_CHANGE_WINDOW_DAYS window. Mirrors the constants in the
// `change_username` RPC (the DB is the authority).
export const USERNAME_CHANGE_LIMIT = 2;
export const USERNAME_CHANGE_WINDOW_DAYS = 60;

export type UsernameChangeStatus = {
  changesLeft: number;
  /** ISO timestamp when the next change frees up; null while one is available. */
  nextChangeAt: string | null;
};

// `changedAt` = ISO timestamps of the caller's changes inside the window.
export function computeUsernameChangeStatus(
  changedAt: string[],
  now: Date = new Date()
): UsernameChangeStatus {
  const windowMs = USERNAME_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = changedAt
    .map((s) => new Date(s).getTime())
    .filter((t) => now.getTime() - t < windowMs)
    .sort((a, b) => a - b);
  const changesLeft = Math.max(0, USERNAME_CHANGE_LIMIT - recent.length);
  if (changesLeft > 0) return { changesLeft, nextChangeAt: null };
  // The oldest change counting toward the limit expires first.
  const freedAt = recent[recent.length - USERNAME_CHANGE_LIMIT] + windowMs;
  return { changesLeft: 0, nextChangeAt: new Date(freedAt).toISOString() };
}
