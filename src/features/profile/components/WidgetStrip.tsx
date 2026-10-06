"use client";

import type { Profile, WidgetInstanceWithCatalog } from "@/lib/types";
import { useFeatureFlags } from "@/features/auth/AuthContext";
import { CalendarWidgetEmbed } from "@/features/booking";
import { AgentWidgetCard } from "@/features/agent";

interface WidgetStripProps {
  widgets: WidgetInstanceWithCatalog[];
  profile: Profile;
  isAuthenticated?: boolean;
}

// Renders the row of widget triggers that sit on top of a profile. Each widget
// type maps to its own embed component; unknown types are skipped.
export function WidgetStrip({ widgets, profile, isAuthenticated = false }: WidgetStripProps) {
  const { ai } = useFeatureFlags();
  return (
    <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
      {widgets.map((w) => {
        switch (w.catalog.slug) {
          case "calendar":
            return <CalendarWidgetEmbed key={w.id} instance={w} profile={profile} />;
          case "agent":
            // The agent is an AI surface — hidden while the AI flag is off even
            // if an owner still has a live agent widget instance.
            if (!ai) return null;
            return (
              <AgentWidgetCard
                key={w.id}
                instance={w}
                profile={profile}
                isAuthenticated={isAuthenticated}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
