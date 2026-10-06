"use client";

import Link from "next/link";
import type { Profile, WidgetInstanceWithCatalog } from "@/lib/types";
import { renderWidgetIcon } from "../widgetIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import { bookingButtonPresentation } from "@/lib/bookingButtonStyle";

interface Props {
  instance: WidgetInstanceWithCatalog;
  profile: Profile;
}

// Trigger pill on the profile. Navigates to the booking page's own shareable
// route (`/[username]/booking/[instanceId]`) instead of opening in place, so the
// destination page can offer a share link + QR — mirroring how spaces work.
// The icon is driven by the catalog entry so any widget type reuses this pill.
export function CalendarWidgetEmbed({ instance, profile }: Props) {
  const { t } = useLanguage();

  // Owner-chosen look (Style picker → Booking); null keeps the default pill.
  const { className, style, iconClass } = bookingButtonPresentation(profile.booking_button_style);

  return (
    <Link
      href={`/${profile.username}/booking/${instance.id}`}
      className={`cursor-pointer ${className}`}
      style={style}
    >
      {renderWidgetIcon(instance.catalog.icon, iconClass)}
      {t.booking.bookNow}
    </Link>
  );
}
