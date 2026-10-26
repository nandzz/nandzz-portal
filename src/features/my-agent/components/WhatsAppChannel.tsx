"use client";

import Link from "next/link";
import { ArrowLeft, Info, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WhatsAppConnection } from "../types";
import { Section } from "./shared";

// Channels → WhatsApp: the business's own number (Coexistence). Shows the real
// connection from whatsapp_connections. Connecting needs Meta's Embedded Signup,
// which isn't built yet, so the button stays disabled until then.

const REQUIREMENTS = [
  "A WhatsApp Business app number (version 2.24.17 or later). Personal WhatsApp numbers can't connect.",
  "You keep using the app on your phone. Disappearing and view-once messages, live location and broadcast lists stop working, and linked devices are unlinked.",
  "Open the app on the phone at least every 14 days, or the number disconnects.",
];

export function WhatsAppChannel({ connection }: { connection: WhatsAppConnection | null }) {
  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/my-agent"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> My Agent
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/15">
          <Phone aria-hidden className="h-5 w-5 text-[#128C7E]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", connection ? "bg-emerald-500" : "bg-muted-foreground/50")} />
            {connection ? `Connected${connection.phone ? ` · +${connection.phone}` : ""}` : "Not connected"}
          </p>
        </div>
      </div>

      {connection ? (
        <Section title="Your number is connected" description="The agent answers customers who write to this number. Every reply also shows up in the WhatsApp Business app on your phone.">
          <p className="text-sm text-muted-foreground">
            Connected on {new Date(connection.connectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
          </p>
        </Section>
      ) : (
        <>
          <Section
            title="Connect your WhatsApp Business number"
            description="Your number stays yours and the app keeps working on your phone. Every reply the agent sends shows up there too."
          >
            <ol className="mb-5 space-y-2 text-sm">
              {["Log in with Facebook and pick your business", "Scan the QR code in the WhatsApp Business app"].map((step, i) => (
                <li key={step} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button className="h-10 bg-[#25D366] text-[#073e2a] hover:bg-[#20bd5a]" disabled>
                <Phone aria-hidden /> Connect with Meta
              </Button>
              <p className="text-xs text-muted-foreground">Connecting a number isn&apos;t available yet.</p>
            </div>
          </Section>

          <Section title="Before you connect">
            <ul className="space-y-2.5">
              {REQUIREMENTS.map((r) => (
                <li key={r} className="flex gap-2.5 text-sm text-muted-foreground">
                  <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}
