"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { CalendarBookingFlow } from "./CalendarBookingFlow";

// Messages posted to the host page by the booking embed. `public/embed.js`
// listens for these; owners can also listen for `nandzz:booked` (re-dispatched
// by embed.js as a DOM event) to track conversions on their own site.
export const EMBED_MESSAGE_SOURCE = "nandzz-booking";

type FlowProps = Omit<ComponentProps<typeof CalendarBookingFlow>, "embedded" | "onBooked" | "stickyActions">;

interface Props extends FlowProps {
  // "inline": the iframe sits in the host page and grows with the flow (we post
  // our height). "popup": embed.js shows us in a fixed-height modal, so the
  // primary action is pinned instead.
  mode: "inline" | "popup";
  children?: React.ReactNode;
}

function post(message: Record<string, unknown>) {
  if (window.parent === window) return;
  // Target "*": the host is any business website and the payload carries no
  // personal data (height, and the fact that a booking happened).
  window.parent.postMessage({ source: EMBED_MESSAGE_SOURCE, ...message }, "*");
}

export function EmbedBooking({ mode, children, ...flow }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Let the host page's own background show through around our card.
  useEffect(() => {
    const html = document.documentElement;
    const prev = [html.style.background, document.body.style.background, document.body.style.minHeight];
    html.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.minHeight = "0";
    return () => {
      [html.style.background, document.body.style.background, document.body.style.minHeight] = prev;
    };
  }, []);

  // Inline mode: report our content height so the iframe never needs its own
  // scrollbar. Measure our wrapper, not the body — the body is sized by the
  // iframe, which would feed back and never let it shrink.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || mode !== "inline") return;
    let last = 0;
    const report = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (height === last) return;
      last = height;
      post({ type: "resize", height });
    };
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    return () => ro.disconnect();
  }, [mode]);

  useEffect(() => {
    post({ type: "ready" });
  }, []);

  return (
    <div ref={rootRef} className="p-1">
      <div className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
        <CalendarBookingFlow
          {...flow}
          embedded
          stickyActions={mode === "popup"}
          onBooked={() => post({ type: "booked" })}
        />
      </div>
      {children}
    </div>
  );
}
