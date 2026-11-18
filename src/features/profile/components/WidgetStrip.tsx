"use client";

import type { Profile, WidgetInstanceWithCatalog } from "@/lib/types";
// Direct path: the feature barrel drags the whole booking UI into every profile.
import { CalendarWidgetEmbed } from "@/features/booking/components/calendar/CalendarWidgetEmbed";

interface WidgetStripProps {
  widgets: WidgetInstanceWithCatalog[];
  profile: Profile;
  align?: "center" | "start";
  className?: string;
}

// Renders the row of widget triggers that sit on top of a profile. Each widget
// type maps to its own embed component; unknown types are skipped.
export function WidgetStrip({ widgets, profile, align = "center", className = "mt-5" }: WidgetStripProps) {
  return (
    <div className={`${className} flex flex-wrap gap-2 ${align === "start" ? "justify-start" : "w-full justify-center"}`}>
      {widgets.map((w) =>
        w.catalog.slug === "calendar" ? <CalendarWidgetEmbed key={w.id} instance={w} profile={profile} /> : null,
      )}
    </div>
  );
}
