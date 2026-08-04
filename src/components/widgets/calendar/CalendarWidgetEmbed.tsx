"use client";

import { useEffect, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import type { Profile, WidgetInstanceWithCatalog } from "@/lib/types";
import { normalizeCalendarConfig } from "@/lib/widgets/calendar";
import { CalendarBookingFlow } from "./CalendarBookingFlow";

interface Props {
  instance: WidgetInstanceWithCatalog;
  profile: Profile;
}

// Trigger pill on the profile → full-screen booking overlay. Mirrors AgentEmbed's
// body-scroll-lock + fixed overlay pattern.
export function CalendarWidgetEmbed({ instance, profile }: Props) {
  const [open, setOpen] = useState(false);
  const displayName = profile.display_name || profile.username;
  const firstName = displayName.split(" ")[0];
  const config = normalizeCalendarConfig(instance.config);

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  const triggerClass =
    "cursor-pointer inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:shadow-sm hover:-translate-y-0.5";

  return (
    <>
      <button onClick={() => setOpen(true)} className={triggerClass}>
        <CalendarDays className="h-4 w-4" />
        Book with {firstName}
      </button>

      {open && (
        <div className="fixed inset-0 bg-background flex flex-col" style={{ zIndex: 200, height: "100dvh" }}>
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex-shrink-0">
                <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold leading-none">Book with {displayName}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Calendar</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-lg w-full mx-auto px-4 py-6">
              <CalendarBookingFlow
                instanceId={instance.id}
                services={config.services}
                timezone={config.timezone}
                businessName={displayName}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
