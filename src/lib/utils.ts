import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Guards against open-redirect via a user-controlled `?next=` param (e.g.
// /login?next=..., /auth/callback?next=...). Only a same-origin path is
// allowed — anything else (absolute URL, protocol-relative "//host", or a
// value like "@evil.com" that URL parsers treat as userinfo) falls back to
// `fallback`. Callers must still prepend their own origin/base before
// building an absolute redirect URL — this only validates the path itself.
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  // Must start with exactly one "/" — rules out absolute URLs, "//host"
  // (protocol-relative), and "/\host" (some browsers normalize "\" to "/").
  if (!/^\/(?!\/|\\)/.test(next)) return fallback;
  return next;
}
