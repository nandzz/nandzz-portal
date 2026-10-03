import type { CSSProperties } from "react";
import type { BookingButtonStyle } from "@/lib/types";
import { isColorDark } from "@/lib/color";

// Shared by the profile booking CTA and the Style picker's live preview so the
// two can never drift.

export const DEFAULT_BOOKING_COLOR = "#10b981"; // emerald-500

export type ResolvedBookingButtonStyle = Required<Omit<BookingButtonStyle, "color">> & {
  color: string | null;
};

export const DEFAULT_BOOKING_BUTTON_STYLE: ResolvedBookingButtonStyle = {
  variant: "soft",
  shape: "pill",
  size: "md",
  color: null,
};

export function resolveBookingButtonStyle(
  s: BookingButtonStyle | null | undefined,
): ResolvedBookingButtonStyle {
  return { ...DEFAULT_BOOKING_BUTTON_STYLE, ...(s ?? {}) };
}

const SHAPE_CLASS = {
  pill: "rounded-full",
  rounded: "rounded-xl",
  square: "rounded-md",
} as const;

const SIZE_CLASS = {
  md: "gap-2 px-4 py-2 text-sm",
  lg: "gap-2.5 px-6 py-3 text-base",
} as const;

// The untouched default keeps the original theme-aware emerald classes (light +
// dark variants) — inline colors only kick in once the owner customizes.
const DEFAULT_SOFT_CLASS =
  "border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40";

export function bookingButtonPresentation(s: BookingButtonStyle | null | undefined): {
  className: string;
  style: CSSProperties | undefined;
  iconClass: string;
} {
  const r = resolveBookingButtonStyle(s);
  const base = `inline-flex items-center font-medium transition-all hover:shadow-sm hover:-translate-y-0.5 ${SHAPE_CLASS[r.shape]} ${SIZE_CLASS[r.size]}`;
  const iconClass = r.size === "lg" ? "h-5 w-5" : "h-4 w-4";

  if (r.variant === "soft" && !r.color) {
    return { className: `${base} ${DEFAULT_SOFT_CLASS}`, style: undefined, iconClass };
  }

  const c = r.color ?? DEFAULT_BOOKING_COLOR;
  switch (r.variant) {
    case "solid":
      return {
        className: `${base} border border-transparent hover:brightness-110`,
        style: { backgroundColor: c, color: isColorDark(c) ? "#ffffff" : "#111827" },
        iconClass,
      };
    case "outline":
      return {
        className: `${base} border-2 bg-transparent hover:bg-current/5`,
        style: { borderColor: c, color: c },
        iconClass,
      };
    case "glass":
      return {
        className: `${base} border border-white/20 bg-background/40 backdrop-blur-md`,
        style: { color: c },
        iconClass,
      };
    case "soft":
    default:
      return {
        className: `${base} border`,
        style: {
          backgroundColor: `color-mix(in srgb, ${c} 14%, transparent)`,
          borderColor: `color-mix(in srgb, ${c} 40%, transparent)`,
          color: c,
        },
        iconClass,
      };
  }
}
