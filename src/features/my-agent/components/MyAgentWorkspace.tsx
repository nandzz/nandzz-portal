"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  ChevronRight,
  MessagesSquare,
  Phone,
  Settings,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { buildMockData } from "../mockData";
import type { MyAgentTab } from "../tabs";
import { setAgentEnabled } from "../actions/agent-settings";
import type { ActivityItem, AgentSettings, KnowledgeEntry } from "../types";
import { ActivityTab } from "./ActivityTab";
import { ConversationsTab } from "./ConversationsTab";
import { WorkflowsTab } from "./WorkflowsTab";
import { KnowledgeTab } from "./KnowledgeTab";
import { UsageTab } from "./UsageTab";
import { SettingsTab } from "./SettingsTab";

const BASE_PATH = "/dashboard/my-agent";

export function MyAgentWorkspace({
  initialTab,
  now,
  activity,
  settings,
  knowledge,
  businessName,
}: {
  initialTab: MyAgentTab;
  /** Server render time — the anchor for every placeholder timestamp. */
  now: number;
  /** Real feed + pending approvals. */
  activity: ActivityItem[];
  settings: AgentSettings;
  knowledge: KnowledgeEntry[];
  businessName: string;
}) {
  const data = useMemo(() => buildMockData(now), [now]);
  const [tab, setTab] = useState<MyAgentTab>(initialTab);
  const router = useRouter();
  // Optimistic: flips at once, rolls back if the save fails.
  const [running, setRunning] = useState(settings.enabled);
  const [toggling, startToggle] = useTransition();
  const toggleRunning = (next: boolean) =>
    startToggle(async () => {
      setRunning(next);
      const res = await setAgentEnabled(next);
      if (!res.ok) setRunning(!next);
      else router.refresh();
    });

  const pending = activity.filter((a) => a.pending).length;
  const live = data.conversations.filter((c) => c.state !== "suspended").length;

  // Same URL model as the booking workspace: reflect the tab in the path with
  // pushState so the component stays mounted (drafts survive tab switches) and
  // the back button steps through visited tabs.
  const handleTabChange = useCallback((value: unknown) => {
    const next = String(value) as MyAgentTab;
    setTab(next);
    window.history.pushState(null, "", next === "activity" ? BASE_PATH : `${BASE_PATH}/${next}`);
  }, []);

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40">
            <Bot aria-hidden className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              My Agent
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Dev preview
              </span>
            </h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", running ? "bg-emerald-500" : "bg-muted-foreground/50")} />
              {running ? `${settings.name} is answering on WhatsApp` : "Off — customers get no replies"}
            </p>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 pt-1 text-sm font-medium">
          <span className="hidden sm:inline">{running ? "On" : "Off"}</span>
          <Switch
            checked={running}
            onCheckedChange={toggleRunning}
            disabled={toggling}
            aria-label={running ? "Turn the agent off" : "Turn the agent on"}
          />
        </label>
      </div>

      {/* Placeholder: always "not connected" until the WhatsApp connection exists. */}
      <Link
        href={`${BASE_PATH}/channels/whatsapp`}
        className="mb-6 flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-muted/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/15">
          <Phone aria-hidden className="h-4 w-4 text-[#128C7E]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Connect your WhatsApp number</span>
          <span className="block truncate text-xs text-muted-foreground">
            The data below is sample content until a number is connected.
          </span>
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      <Tabs value={tab} onValueChange={handleTabChange} className="gap-6">
        {/* Inactive tabs collapse to icon-only on phones, like the booking tabs. */}
        <TabsList variant="line" className="h-9 w-full sm:w-max">
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4" /> <TabLabel>Activity</TabLabel>
            {pending > 0 && <Badge>{pending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="conversations">
            <MessagesSquare className="h-4 w-4" /> <TabLabel>Assistance</TabLabel>
            {live > 0 && <Badge>{live}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="workflows">
            <WorkflowIcon className="h-4 w-4" /> <TabLabel>Workflows</TabLabel>
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <BookOpen className="h-4 w-4" /> <TabLabel>Knowledge</TabLabel>
          </TabsTrigger>
          <TabsTrigger value="usage">
            <BarChart3 className="h-4 w-4" /> <TabLabel>Usage</TabLabel>
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4" /> <TabLabel>Settings</TabLabel>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <ActivityTab items={activity} now={now} />
        </TabsContent>
        <TabsContent value="conversations">
          <ConversationsTab conversations={data.conversations} now={now} takeoverMinutes={settings.takeoverMinutes} />
        </TabsContent>
        <TabsContent value="workflows">
          <WorkflowsTab workflows={data.workflows} />
        </TabsContent>
        <TabsContent value="knowledge">
          <KnowledgeTab entries={knowledge} now={now} />
        </TabsContent>
        <TabsContent value="usage">
          <UsageTab usage={data.usage} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab initial={settings} businessName={businessName} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function TabLabel({ children }: { children: ReactNode }) {
  return <span className="sr-only sm:not-sr-only in-data-active:not-sr-only">{children}</span>;
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="min-w-4 rounded-full bg-violet-600 px-1 text-[10px] font-semibold leading-4 text-white tabular-nums">
      {children}
    </span>
  );
}
