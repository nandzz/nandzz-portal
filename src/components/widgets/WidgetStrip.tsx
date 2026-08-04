"use client";

import type { Profile, WidgetInstanceWithCatalog } from "@/lib/types";
import { CalendarWidgetEmbed } from "./calendar/CalendarWidgetEmbed";

interface WidgetStripProps {
  widgets: WidgetInstanceWithCatalog[];
  profile: Profile;
}

// Renders the row of widget triggers that sit on top of a profile. Each widget
// type maps to its own embed component; unknown types are skipped.
export function WidgetStrip({ widgets, profile }: WidgetStripProps) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {widgets.map((w) => {
        switch (w.catalog.slug) {
          case "calendar":
            return <CalendarWidgetEmbed key={w.id} instance={w} profile={profile} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
