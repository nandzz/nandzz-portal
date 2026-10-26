"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import type { UsageSummary } from "../types";
import { Meter, Section } from "./shared";

const fmt = (n: number) => n.toLocaleString("en-US");

// Meta delivers this many agent replies per number per month without a card.
const META_FREE_REPLIES = 1_000;

export function UsageTab({ usage }: { usage: UsageSummary }) {
  const { inbound, replies, daily } = usage;
  const metaRatio = replies / META_FREE_REPLIES;
  const peak = Math.max(...daily, 1);

  return (
    <div className="space-y-4">
      <Section title="Served messages" description={`Every message the agent reads or sends · ${usage.periodLabel}`}>
        <p className="mb-2 text-2xl font-semibold tabular-nums">{fmt(inbound + replies)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {[
            { label: "Inbound", value: inbound },
            { label: "Agent replies", value: replies },
          ].map((b) => (
            <div key={b.label} className="rounded-lg bg-muted/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{b.label}</dt>
              <dd className="text-sm font-semibold tabular-nums">{fmt(b.value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Your own replies from the phone don&apos;t count.</p>
      </Section>

      <Section title="Last 14 days" description="Served messages per day">
        <div className="flex h-24 items-end gap-1" role="img" aria-label="Served messages per day, last 14 days">
          {daily.map((v, i) => (
            <div key={i} className="flex-1 rounded-t bg-violet-600/80" style={{ height: `${(v / peak) * 100}%` }} title={`${v}`} />
          ))}
        </div>
      </Section>

      <Section title="WhatsApp free replies" description="Meta delivers 1,000 agent replies per number per month without a card.">
        <p className="mb-2 text-sm tabular-nums">
          <span className="font-semibold">{fmt(replies)}</span>
          <span className="text-muted-foreground"> / {fmt(META_FREE_REPLIES)} used</span>
        </p>
        <Meter value={replies} max={META_FREE_REPLIES} />
        {metaRatio >= 0.8 && (
          <div className="mt-3 flex gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm dark:border-amber-800/60 dark:bg-amber-950/30">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="font-medium">You&apos;re close to Meta&apos;s free cap</p>
              <p className="mt-0.5 text-muted-foreground">
                Add a card in WhatsApp Manager so replies don&apos;t stop this month.
              </p>
              <a
                href="https://business.facebook.com/wa/manage/"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:underline"
              >
                Open WhatsApp Manager <ExternalLink aria-hidden className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
