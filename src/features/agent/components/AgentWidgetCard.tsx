"use client";

import { useState } from "react";
import type { Profile, WidgetInstanceWithCatalog } from "@/lib/types";
import { renderWidgetIcon } from "@/features/booking";
import { AgentChatOverlay } from "./AgentChatOverlay";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  instance: WidgetInstanceWithCatalog;
  profile: Profile;
  isAuthenticated: boolean;
}

// Card trigger for the agent widget on the profile strip. Unlike the calendar
// widget (which navigates to its own shareable route), the agent opens directly
// in a fullscreen chat overlay in place — same overlay the old always-on
// AgentEmbed pill used, just gated through the widget strip's entitlement now.
export function AgentWidgetCard({ instance, profile, isAuthenticated }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const displayName = profile.display_name || profile.username;
  const firstName = displayName.split(" ")[0];

  const triggerClass =
    "cursor-pointer inline-flex items-center gap-2 rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-4 py-2 text-sm font-medium text-violet-700 dark:text-violet-300 transition-all hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:shadow-sm hover:-translate-y-0.5";

  return (
    <>
      <button onClick={() => setOpen(true)} className={triggerClass}>
        {renderWidgetIcon(instance.catalog.icon, "h-4 w-4")}
        {t.agent.talkToAgent.replace("{name}", firstName)}
      </button>

      <AgentChatOverlay
        profile={profile}
        isAuthenticated={isAuthenticated}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
