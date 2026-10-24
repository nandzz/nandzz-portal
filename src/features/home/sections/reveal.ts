import { EASE_OUT } from "../showcase/phone";

export const muted = "text-[color-mix(in_oklab,var(--clay-ink)_60%,transparent)]";

// One-shot "rise into view" for home sections. The target always carries the
// transform (reduced motion is only known after hydration, so the initial
// offset may already be applied); reduced motion just snaps it, keeping the fade.
export function reveal(reduce: boolean, delay = 0, from = "translateY(14px)", to = "translateY(0px)") {
  return {
    initial: { opacity: 0, transform: from },
    whileInView: { opacity: 1, transform: to },
    viewport: { once: true, amount: 0.3 },
    transition: reduce
      ? { opacity: { duration: 0.4, delay }, transform: { duration: 0 } }
      : { duration: 0.55, ease: EASE_OUT, delay },
  } as const;
}
