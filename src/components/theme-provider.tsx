"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// The booking embed ("/<username>/booking/embed") runs inside a business's
// website: its look comes from the snippet's `?theme=`, never from the
// visitor's nandzz.com preference. Forcing it here (not just on a wrapper)
// also themes dialogs the flow portals to <body>.
const EMBED_RE = /^\/[^/]+\/booking\/embed\/?$/;

function embedTheme(pathname: string | null): "light" | "dark" | undefined {
  if (!pathname || !EMBED_RE.test(pathname)) return undefined;
  if (typeof window === "undefined") return "light";
  return new URLSearchParams(window.location.search).get("theme") === "dark" ? "dark" : "light";
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const pathname = usePathname();
  return (
    <NextThemesProvider {...props} forcedTheme={embedTheme(pathname) ?? props.forcedTheme}>
      {children}
    </NextThemesProvider>
  );
}
