"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * `<Link>` that prefetches only on hover/touch instead of when it enters the
 * viewport. Use for large lists of links to dynamic routes (space cards,
 * gallery tiles) — viewport prefetching fires a server render + DB query per
 * visible card.
 */
export function HoverPrefetchLink({
  onMouseEnter,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [active, setActive] = useState(false);

  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onMouseEnter={(e) => {
        setActive(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setActive(true);
        onTouchStart?.(e);
      }}
    />
  );
}
