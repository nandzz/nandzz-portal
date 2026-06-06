"use client";

import { useState, useEffect } from "react";
import { X, Bot } from "lucide-react";
import { AgentChat } from "./AgentChat";
import type { Profile } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface AgentEmbedProps {
  profile: Profile;
  isAuthenticated: boolean;
}

export function AgentEmbed({ profile, isAuthenticated }: AgentEmbedProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const displayName = profile.display_name || profile.username;
  const firstName = displayName.split(" ")[0];

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

  const triggerClass = "cursor-pointer mt-5 inline-flex items-center gap-2 rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-4 py-2 text-sm font-medium text-violet-700 dark:text-violet-300 transition-all hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:shadow-sm hover:-translate-y-0.5";

  return (
    <>
      <button onClick={() => setOpen(true)} className={triggerClass}>
        <Bot className="h-4 w-4" />
        {t.agent.talkToAgent.replace("{name}", firstName)}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-background flex flex-col"
          style={{ zIndex: 200, height: "100dvh" }}
        >
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/40 flex-shrink-0">
                <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-semibold leading-none">{t.agent.askUser.replace("{name}", displayName)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t.agent.aiAgentLabel}</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={t.agent.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col max-w-2xl w-full mx-auto">
            <AgentChat username={profile.username} displayName={displayName} />
          </div>
        </div>
      )}
    </>
  );
}
