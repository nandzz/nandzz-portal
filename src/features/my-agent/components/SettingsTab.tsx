"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { WeekdayKey } from "@/lib/types";
import { saveAgentSettings } from "../actions/agent-settings";
import { AUTONOMY_CAPABILITIES, LIMITS, RETENTION_MONTHS } from "../settings";
import type { AgentSettings, Autonomy, AutonomyCapability } from "../types";
import { Section, Segmented } from "./shared";

const AUTONOMY_LABEL: Record<Autonomy, string> = { off: "Off", pending: "Pending", confirm: "Confirm" };

const AUTONOMY_HINT: Record<Autonomy, string> = {
  off: "The agent offers to hand the chat to you.",
  pending: "The customer confirms in chat, then you approve.",
  confirm: "Confirmed as soon as the customer says yes.",
};

const CAPABILITY_LABEL: Record<AutonomyCapability, string> = {
  new_booking: "New booking",
  reschedule: "Reschedule / change",
  cancel: "Cancel",
};

const DAY_LABEL: Record<WeekdayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export function SettingsTab({ initial, businessName }: { initial: AgentSettings; businessName: string }) {
  // `initial` is the saved row; after a save the server re-renders with the new
  // row and the draft is compared against it again.
  const router = useRouter();
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // The on/off switch lives in the header and saves on its own.
  const dirty = JSON.stringify({ ...draft, enabled: false }) !== JSON.stringify({ ...baseline, enabled: false });
  const badHours = draft.limitHours && draft.hours.some((h) => h.enabled && h.from >= h.to);
  const canSave = draft.name.trim().length > 0 && !badHours;

  const patch = (next: Partial<AgentSettings>) => setDraft((d) => ({ ...d, ...next }));

  const save = () =>
    startSaving(async () => {
      setError(null);
      const res = await saveAgentSettings(draft);
      if (!res.ok) {
        setError(res.error === "INVALID_INPUT" ? "Some values aren't valid. Check the fields and try again." : "Couldn't save. Please try again.");
        return;
      }
      setBaseline(draft);
      router.refresh();
    });

  const introPreview = draft.intro.trim() || `the virtual assistant of ${businessName}`;

  return (
    <div className="space-y-4 pb-20">
      <Section title="Identity" description="Who the agent says it is. The first message of every chat always says it's an AI.">
        <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">Name</Label>
              <Input id="agent-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} maxLength={LIMITS.name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-intro">Role</Label>
              <Textarea
                id="agent-intro"
                value={draft.intro}
                onChange={(e) => patch({ intro: e.target.value })}
                rows={3}
                maxLength={LIMITS.intro}
                placeholder={`the virtual assistant of ${businessName}`}
              />
              <p className="text-xs text-muted-foreground">One short phrase, e.g. &ldquo;the receptionist of the salon&rdquo;.</p>
            </div>
          </div>
          {/* Live preview of the first message a new chat receives. */}
          <div className="rounded-xl bg-[#efeae2] p-3 dark:bg-[#0b141a]">
            <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
              Sample first message
            </p>
            <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3 py-2 text-sm text-black shadow-sm dark:bg-[#005c4b] dark:text-white">
              <p>
                Hi! I&apos;m {draft.name.trim() || "…"}, {introPreview}. How can I help?
              </p>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] opacity-70">
                <Bot aria-hidden className="h-3 w-3" /> AI assistant
              </p>
            </div>
            <p className="mt-2 text-center text-[10px] text-black/50 dark:text-white/50">
              Written by the agent in the customer&apos;s language.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="What the agent may do"
        description="It always answers questions from your knowledge. Bookings: only ever for the customer in the chat."
      >
        <ul className="divide-y divide-border/60">
          {AUTONOMY_CAPABILITIES.map((c) => (
            <li key={c} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{CAPABILITY_LABEL[c]}</p>
                <p className="text-xs text-muted-foreground">{AUTONOMY_HINT[draft.autonomy[c]]}</p>
              </div>
              <Segmented
                ariaLabel={CAPABILITY_LABEL[c]}
                size="sm"
                value={draft.autonomy[c]}
                options={(["off", "pending", "confirm"] as const).map((o) => ({ value: o, label: AUTONOMY_LABEL[o] }))}
                onChange={(value) => patch({ autonomy: { ...draft.autonomy, [c]: value } })}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Working hours"
        description="Outside these hours the agent stays silent. Times are in your calendar's timezone."
        action={
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <span className="text-muted-foreground">Set hours</span>
            <Switch checked={draft.limitHours} onCheckedChange={(limitHours) => patch({ limitHours })} />
          </label>
        }
      >
        {draft.limitHours ? (
          <ul className="space-y-1.5">
            {draft.hours.map((h, i) => {
              const set = (next: Partial<typeof h>) =>
                patch({ hours: draft.hours.map((x, j) => (j === i ? { ...x, ...next } : x)) });
              const label = DAY_LABEL[h.day];
              return (
                <li key={h.day} className="flex items-center gap-3">
                  <Switch checked={h.enabled} onCheckedChange={(enabled) => set({ enabled })} aria-label={`Work on ${label}`} />
                  <span className={cn("w-10 text-sm font-medium", !h.enabled && "text-muted-foreground")}>{label}</span>
                  {h.enabled ? (
                    <span className="flex items-center gap-1.5 text-sm">
                      <TimeInput value={h.from} onChange={(from) => set({ from })} label={`${label} from`} />
                      <span className="text-muted-foreground">–</span>
                      <TimeInput value={h.to} onChange={(to) => set({ to })} label={`${label} to`} invalid={h.from >= h.to} />
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Off</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Around the clock, every day.</p>
        )}
        {badHours && <p className="mt-2 text-xs text-destructive">Each day must end after it starts.</p>}
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
              min={LIMITS.takeoverMin}
              max={LIMITS.takeoverMax}
              value={draft.takeoverMinutes}
              onChange={(e) =>
                patch({
                  takeoverMinutes: Math.max(LIMITS.takeoverMin, Math.min(LIMITS.takeoverMax, Math.round(Number(e.target.value)) || 1)),
                })
              }
              className="h-9 w-20 tabular-nums"
            />
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
        </div>
      </Section>

      <Section title="Keep messages for" description="Message content and voice transcripts are deleted after this. Bookings stay.">
        <Segmented
          ariaLabel="Retention"
          value={String(draft.retentionMonths)}
          options={RETENTION_MONTHS.map((m) => ({ value: String(m), label: m === 12 ? "1 year" : m === 1 ? "1 month" : `${m} months` }))}
          onChange={(v) => patch({ retentionMonths: Number(v) as AgentSettings["retentionMonths"] })}
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
          <span className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
            {error ?? "Unsaved changes"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                setDraft(baseline);
                setError(null);
              }}
            >
              Discard
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !canSave}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeInput({
  value,
  onChange,
  label,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  invalid?: boolean;
}) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      className="h-8 rounded-md border border-input aria-invalid:border-destructive bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
