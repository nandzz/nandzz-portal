"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { MessageTemplate } from "@/lib/types";
import { MESSAGE_CHANNELS, MESSAGE_VARIABLES } from "@/lib/widgets/messages";

interface Props {
  title: string;
  description: string;
  value: MessageTemplate;
  onChange: (t: MessageTemplate) => void;
}

export function MessageTemplateEditor({ title, description, value, onChange }: Props) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const showEmail = value.channel === "email" || value.channel === "both";
  const disabled = value.channel === "off";
  const inputCls = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm";

  // Insert a {{token}} at the caret (or append if the textarea isn't focused).
  function insertVar(key: string) {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    if (!el) {
      onChange({ ...value, body: value.body + token });
      return;
    }
    const start = el.selectionStart ?? value.body.length;
    const end = el.selectionEnd ?? value.body.length;
    const next = value.body.slice(0, start) + token + value.body.slice(end);
    onChange({ ...value, body: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 rounded-lg border border-border p-0.5 text-xs">
          {MESSAGE_CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange({ ...value, channel: c.value })}
              className={cn(
                "rounded-md px-2 py-1 font-medium transition",
                value.channel === c.value
                  ? "bg-emerald-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {disabled ? (
        <p className="text-xs text-muted-foreground">This message is turned off — customers won’t receive it.</p>
      ) : (
        <>
          {showEmail && (
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Email subject</span>
              <input
                className={`${inputCls} w-full`}
                value={value.subject}
                onChange={(e) => onChange({ ...value, subject: e.target.value })}
                placeholder="Booking confirmed"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Message</span>
            <textarea
              ref={bodyRef}
              rows={5}
              className={`${inputCls} w-full resize-y font-mono text-[13px] leading-relaxed`}
              value={value.body}
              onChange={(e) => onChange({ ...value, body: e.target.value })}
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Insert:</span>
            {MESSAGE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVar(v.key)}
                title={`${v.label} — e.g. ${v.sample}`}
                className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition hover:border-emerald-400 hover:text-foreground"
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
