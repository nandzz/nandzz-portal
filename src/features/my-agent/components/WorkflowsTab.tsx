"use client";

import { useState } from "react";
import { ArrowRight, Bell, CalendarClock, FlaskConical, Hand, Lock, MessageSquare, Plus, Ban, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { RuleAction, Workflow } from "../types";
import { ResponsivePanel } from "./shared";

// Workflows are rules in plain words: "When <situation> → <action>". The model
// judges whether the situation applies (not keywords); the action comes from a
// fixed, safe list. Built-in rules can be switched off but not edited.

const ACTIONS: { value: RuleAction; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "send_message", label: "Send a message", hint: "The agent replies with your text", icon: MessageSquare },
  { value: "alert_owner", label: "Alert me", hint: "WhatsApp, email and in-app", icon: Bell },
  { value: "pending_booking", label: "Create a pending booking", hint: "You approve it in Activity", icon: CalendarClock },
  { value: "hand_off", label: "Hand off to me", hint: "The customer is told you'll reply", icon: Hand },
  { value: "suspend_chat", label: "Switch the agent off in this chat", hint: "Until you turn it back on", icon: Ban },
];

const actionMeta = (a: RuleAction) => ACTIONS.find((x) => x.value === a)!;

export function WorkflowsTab({ workflows: initial }: { workflows: Workflow[] }) {
  const [workflows, setWorkflows] = useState(initial);
  const [editing, setEditing] = useState<Workflow | "new" | null>(null);

  const builtIn = workflows.filter((w) => w.builtIn);
  const custom = workflows.filter((w) => !w.builtIn);

  const toggle = (id: string, enabled: boolean) =>
    setWorkflows((list) => list.map((w) => (w.id === id ? { ...w, enabled } : w)));

  const save = (rule: Workflow) => {
    setWorkflows((list) => (list.some((w) => w.id === rule.id) ? list.map((w) => (w.id === rule.id ? rule : w)) : [...list, rule]));
    setEditing(null);
  };
  const remove = (id: string) => {
    setWorkflows((list) => list.filter((w) => w.id !== id));
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Built in</h3>
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
          {builtIn.map((w) => (
            <RuleRow key={w.id} rule={w} onToggle={toggle} />
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your rules</h3>
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <Plus aria-hidden /> New rule
          </Button>
        </div>
        {custom.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Add a rule like “When a customer complains → alert me”.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
            {custom.map((w) => (
              <RuleRow key={w.id} rule={w} onToggle={toggle} onOpen={() => setEditing(w)} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Rules never go beyond the chat&apos;s own customer or your autonomy settings.
        </p>
      </div>

      {editing && (
        <RuleEditor
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={editing === "new" ? undefined : () => remove(editing.id)}
        />
      )}
    </div>
  );
}

function RuleRow({
  rule,
  onToggle,
  onOpen,
}: {
  rule: Workflow;
  onToggle: (id: string, enabled: boolean) => void;
  onOpen?: () => void;
}) {
  const meta = actionMeta(rule.action);
  const Icon = meta.icon;
  const body = (
    <>
      <span className="block text-sm">
        <span className="text-muted-foreground">When </span>
        <span className="font-medium">{rule.when.charAt(0).toLowerCase() + rule.when.slice(1)}</span>
      </span>
      <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
        <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{rule.action === "send_message" && rule.message ? rule.message : meta.label}</span>
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">
        {rule.builtIn && <Lock aria-hidden className="mr-1 inline h-3 w-3 align-[-2px]" />}
        Fired {rule.firedThisMonth}× this month
      </span>
    </>
  );
  return (
    <li className={cn("flex items-center gap-3 px-4 py-3.5", !rule.enabled && "opacity-60")}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:underline">
          {body}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
      <Switch
        checked={rule.enabled}
        onCheckedChange={(checked) => onToggle(rule.id, checked)}
        aria-label={rule.enabled ? "Turn rule off" : "Turn rule on"}
      />
    </li>
  );
}

function RuleEditor({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Workflow | null;
  onClose: () => void;
  onSave: (rule: Workflow) => void;
  onDelete?: () => void;
}) {
  const [when, setWhen] = useState(initial?.when ?? "");
  const [action, setAction] = useState<RuleAction>(initial?.action ?? "alert_owner");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [sample, setSample] = useState("");
  const [verdict, setVerdict] = useState<null | "match" | "no_match">(null);

  const valid = when.trim().length > 3 && (action !== "send_message" || message.trim().length > 0);

  // Placeholder: the real test asks the model whether the sample fits `when`.
  const runTest = () => {
    const words = when.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const hit = words.some((w) => sample.toLowerCase().includes(w));
    setVerdict(hit ? "match" : "no_match");
  };

  return (
    <ResponsivePanel
      open
      onClose={onClose}
      title={initial ? "Edit rule" : "New rule"}
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <Button variant="destructive" className="h-10" onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button
            className="h-10 flex-1"
            disabled={!valid}
            onClick={() =>
              onSave({
                id: initial?.id ?? `w${Date.now()}`,
                builtIn: false,
                when: when.trim(),
                action,
                message: action === "send_message" ? message.trim() : undefined,
                enabled: initial?.enabled ?? true,
                firedThisMonth: initial?.firedThisMonth ?? 0,
              })
            }
          >
            Save rule
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="rule-when">When…</Label>
          <Textarea
            id="rule-when"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            placeholder="a customer complains about a service"
            rows={2}
          />
          <p className="text-xs text-muted-foreground">Describe the situation in your own words. The agent decides when it applies.</p>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-sm font-medium">Then…</legend>
          <div className="space-y-1.5">
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              const active = a.value === action;
              return (
                <label
                  key={a.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    active ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30" : "border-border/60 hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="rule-action"
                    value={a.value}
                    checked={active}
                    onChange={() => setAction(a.value)}
                    className="sr-only"
                  />
                  <Icon aria-hidden className={cn("h-4 w-4 shrink-0", active ? "text-violet-600" : "text-muted-foreground")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block text-xs text-muted-foreground">{a.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {action === "send_message" && (
          <div className="space-y-1.5">
            <Label htmlFor="rule-message">Message</Label>
            <Textarea id="rule-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
            <p className="text-xs text-muted-foreground">Sent in the customer&apos;s language.</p>
          </div>
        )}

        <div className="space-y-2 rounded-lg bg-muted/60 p-3">
          <Label htmlFor="rule-sample" className="flex items-center gap-1.5">
            <FlaskConical aria-hidden className="h-3.5 w-3.5" /> Try it on a sample message
          </Label>
          <div className="flex gap-2">
            <input
              id="rule-sample"
              value={sample}
              onChange={(e) => {
                setSample(e.target.value);
                setVerdict(null);
              }}
              placeholder="“The cut was terrible”"
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button variant="outline" className="h-9" disabled={!sample.trim() || !when.trim()} onClick={runTest}>
              Test
            </Button>
          </div>
          {verdict && (
            <p className={cn("text-xs font-medium", verdict === "match" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
              {verdict === "match" ? "This rule would fire." : "This rule wouldn't fire."}{" "}
              <span className="font-normal text-muted-foreground">(Preview — the real check runs on the agent.)</span>
            </p>
          )}
        </div>
      </div>
    </ResponsivePanel>
  );
}
