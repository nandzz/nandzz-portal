"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AgentSettingsDraft, Autonomy } from "../types";
import { Section, Segmented } from "./shared";

const AUTONOMY_LABEL: Record<Autonomy, string> = {
  off: "Off",
  answer: "Answer",
  answer_handoff: "Answer + hand off",
  pending: "Pending",
  confirm: "Confirm",
  on: "On",
};

const AUTONOMY_HINT: Partial<Record<Autonomy, string>> = {
  answer: "Answers everything it can from your knowledge.",
  answer_handoff: "Hard or sensitive questions go to you.",
  pending: "The customer confirms in chat, then you approve.",
  confirm: "Confirmed as soon as the customer says yes.",
};

const RETENTION = [1, 3, 6, 12];

export function SettingsTab({ initial }: { initial: AgentSettingsDraft }) {
  // `baseline` = last saved state. Saving is a placeholder (local only) until
  // the agent settings table exists.
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const patch = (next: Partial<AgentSettingsDraft>) => setDraft((d) => ({ ...d, ...next }));

  return (
    <div className="space-y-4 pb-20">
      <Section title="Identity" description="How the agent introduces itself. The first message always says it's an AI.">
        <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">Name</Label>
              <Input id="agent-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} maxLength={30} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-intro">Introduction</Label>
              <Textarea id="agent-intro" value={draft.intro} onChange={(e) => patch({ intro: e.target.value })} rows={4} maxLength={300} />
            </div>
          </div>
          {/* Live preview of the first message a new chat receives. */}
          <div className="rounded-xl bg-[#efeae2] p-3 dark:bg-[#0b141a]">
            <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
              First message preview
            </p>
            <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3 py-2 text-sm text-black shadow-sm dark:bg-[#005c4b] dark:text-white">
              <p>{draft.intro || "…"}</p>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] opacity-70">
                <Bot aria-hidden className="h-3 w-3" /> AI assistant{draft.name ? ` · ${draft.name}` : ""}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="What the agent may do" description="Per capability. It only ever acts for the customer in the chat.">
        <ul className="divide-y divide-border/60">
          {draft.capabilities.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{AUTONOMY_HINT[c.value] ?? c.hint}</p>
              </div>
              <Segmented
                ariaLabel={c.label}
                size="sm"
                value={c.value}
                options={c.options.map((o) => ({ value: o, label: AUTONOMY_LABEL[o] }))}
                onChange={(value) =>
                  patch({ capabilities: draft.capabilities.map((x) => (x.id === c.id ? { ...x, value } : x)) })
                }
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Working hours" description="Outside these hours the agent stays silent.">
        <ul className="space-y-1.5">
          {draft.hours.map((h, i) => {
            const set = (next: Partial<typeof h>) =>
              patch({ hours: draft.hours.map((x, j) => (j === i ? { ...x, ...next } : x)) });
            return (
              <li key={h.day} className="flex items-center gap-3">
                <Switch checked={h.enabled} onCheckedChange={(enabled) => set({ enabled })} aria-label={`Work on ${h.day}`} />
                <span className={cn("w-10 text-sm font-medium", !h.enabled && "text-muted-foreground")}>{h.day}</span>
                {h.enabled ? (
                  <span className="flex items-center gap-1.5 text-sm">
                    <TimeInput value={h.from} onChange={(from) => set({ from })} label={`${h.day} from`} />
                    <span className="text-muted-foreground">–</span>
                    <TimeInput value={h.to} onChange={(to) => set({ to })} label={`${h.day} to`} />
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Off</span>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="When you reply from the phone" description="The agent pauses that chat so you can talk. It resumes only if something is still open.">
        <div className="flex items-center gap-3">
          <Label htmlFor="takeover" className="text-sm font-normal">
            Pause for
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="takeover"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={draft.takeoverMinutes}
              onChange={(e) => patch({ takeoverMinutes: Math.max(1, Math.min(120, Number(e.target.value) || 1)) })}
              className="h-9 w-20 tabular-nums"
            />
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
        </div>
      </Section>

      <Section title="Alerts" description="How we reach you for handoffs, approvals and limits.">
        <div className="space-y-3">
          {(
            [
              ["email", "Email"],
              ["whatsapp", "WhatsApp (from the Nandzz number)"],
              ["inApp", "In-app notifications"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 text-sm">
              {label}
              <Switch
                checked={draft.alerts[key]}
                onCheckedChange={(v) => patch({ alerts: { ...draft.alerts, [key]: v } })}
              />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Keep messages for" description="Message content and voice transcripts are deleted after this. Bookings stay.">
        <Segmented
          ariaLabel="Retention"
          value={String(draft.retentionMonths)}
          options={RETENTION.map((m) => ({ value: String(m), label: m === 12 ? "1 year" : `${m} months` }))}
          onChange={(v) => patch({ retentionMonths: Number(v) })}
        />
      </Section>

      {/* Sticky save bar — appears only with unsaved changes. */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 transition-[opacity,transform] duration-200 ease-out md:bottom-6 md:left-64",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur">
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(baseline)}>
              Discard
            </Button>
            <Button size="sm" onClick={() => setBaseline(draft)}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
