"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, History, MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Section } from "./shared";

// Knowledge = the existing Knowledge Studio documents + what the agent learned
// from imported WhatsApp history. The "learned" part is placeholder content
// until the history import exists.

const LEARNED = {
  faqs: [
    { q: "Do you take walk-ins?", a: "Only on weekday mornings, otherwise by appointment." },
    { q: "How much is a haircut?", a: "From 25 €; with styling 35 €." },
    { q: "Is there parking?", a: "Free parking behind the building after 18:00." },
  ],
  tone: ["Friendly", "Informal (tu)", "Short replies", "Emoji sometimes"],
};

export function KnowledgeTab({ knowledgeStudioHref }: { knowledgeStudioHref: string | null }) {
  return (
    <div className="space-y-4">
      <Section
        title="Your documents"
        description="Price lists, policies and FAQs the agent answers from."
        action={<BookOpen aria-hidden className="h-4 w-4 text-muted-foreground" />}
      >
        {knowledgeStudioHref ? (
          <Link href={knowledgeStudioHref} className={cn(buttonVariants({ variant: "outline" }), "h-9")}>
            Open Knowledge Studio <ChevronRight aria-hidden />
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">The Knowledge Studio moves here in a later step.</p>
        )}
      </Section>

      <Section
        title="Learned from your chats"
        description="Built once from up to 180 days of WhatsApp history after you connect."
        action={<History aria-hidden className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frequent questions</p>
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {LEARNED.faqs.map((f) => (
                <li key={f.q} className="flex gap-3 px-3 py-2.5">
                  <MessageCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{f.q}</p>
                    <p className="text-muted-foreground">{f.a}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your tone</p>
            <div className="flex flex-wrap gap-1.5">
              {LEARNED.tone.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Sample content — the real list appears after the history import.</p>
        </div>
      </Section>
    </div>
  );
}
