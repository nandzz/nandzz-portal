import { createElement, type ReactElement } from "react";
import {
  Blocks,
  Calendar,
  CalendarClock,
  CalendarDays,
  Clock,
  CreditCard,
  Gift,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  Sparkles,
  Star,
  Ticket,
  Video,
  type LucideIcon,
} from "lucide-react";

// Maps a widget catalog `icon` string → a lucide-react component so the trigger
// row and overlays aren't hardcoded to any single widget type. Widgets can be
// anything in the future; unknown/absent names fall back to a generic glyph.
//
// The catalog seeds lucide names in kebab-case (e.g. "calendar-days"), but be
// tolerant of pascal/snake/spacing too — everything is normalized to a bare
// lowercase key before lookup.
const WIDGET_ICONS: Record<string, LucideIcon> = {
  blocks: Blocks,
  calendar: Calendar,
  calendarclock: CalendarClock,
  calendardays: CalendarDays,
  clock: Clock,
  creditcard: CreditCard,
  gift: Gift,
  mail: Mail,
  mappin: MapPin,
  messagecircle: MessageCircle,
  phone: Phone,
  shoppingbag: ShoppingBag,
  sparkles: Sparkles,
  star: Star,
  ticket: Ticket,
  video: Video,
};

// Generic fallback when the catalog icon is null or unrecognized.
export const FALLBACK_WIDGET_ICON: LucideIcon = Blocks;

export function resolveWidgetIcon(icon: string | null | undefined): LucideIcon {
  if (!icon) return FALLBACK_WIDGET_ICON;
  const key = icon.replace(/[-_\s]+/g, "").toLowerCase();
  return WIDGET_ICONS[key] ?? FALLBACK_WIDGET_ICON;
}

// Renders the resolved icon as an element. Callers use this (rather than
// assigning the resolved component to a capitalized local and rendering it)
// so the icon component stays static — created here, not during a render.
export function renderWidgetIcon(
  icon: string | null | undefined,
  className?: string
): ReactElement {
  return createElement(resolveWidgetIcon(icon), className ? { className } : {});
}
