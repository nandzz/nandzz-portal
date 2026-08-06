"use client";

import Link from "next/link";
import type { Profile, WidgetInstanceWithCatalog } from "@/lib/types";
import { renderWidgetIcon } from "../widgetIcon";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  instance: WidgetInstanceWithCatalog;
  profile: Profile;
}

// Trigger pill on the profile. Navigates to the widget's own shareable route
// (`/[username]/widget/[instanceId]`) instead of opening in place, so the
// destination page can offer a share link + QR — mirroring how spaces work.
// The icon is driven by the catalog entry so any widget type reuses this pill.
export function CalendarWidgetEmbed({ instance, profile }: Props) {
  const { t } = useLanguage();
  const displayName = profile.display_name || profile.username;
  const firstName = displayName.split(" ")[0];

  const triggerClass =
    "cursor-pointer inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:shadow-sm hover:-translate-y-0.5";

  return (
    <Link href={`/${profile.username}/widget/${instance.id}`} className={triggerClass}>
      {renderWidgetIcon(instance.catalog.icon, "h-4 w-4")}
      {t.booking.bookWithName.replace("{name}", firstName)}
    </Link>
  );
}
