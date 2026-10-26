"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Info, Phone, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { disconnectWhatsApp } from "../actions/agent-data";
import type { WhatsAppConnection } from "../types";
import { Section } from "./shared";

// Channels → WhatsApp: the business's own number (Coexistence). Shows the real
// connection from whatsapp_connections, what the business agrees to and how
// customer data is handled, and lets the owner disconnect. Connecting needs
// Meta's Embedded Signup, which isn't built yet, so that button stays disabled.

const REQUIREMENTS = [
  "A WhatsApp Business app number (version 2.24.17 or later). Personal WhatsApp numbers can't connect.",
  "You keep using the app on your phone. Disappearing and view-once messages, live location and broadcast lists stop working, and linked devices are unlinked.",
  "Open the app on the phone at least every 14 days, or the number disconnects.",
];

const META_TERMS = [
  { label: "WhatsApp Business Terms of Service", href: "https://www.whatsapp.com/legal/business-terms" },
  { label: "WhatsApp Business Messaging Policy", href: "https://business.whatsapp.com/policy" },
];

const NANDZZ_TERMS = [
  { label: "Nandzz Terms", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Data Processing Agreement", href: "/dpa" },
];

const RESPONSIBILITIES = [
  "Follow WhatsApp's Business Terms and Messaging Policy for everything sent from your number, including the agent's replies.",
  "Tell your customers that an AI assistant may answer on this number, and that they can ask to talk to a person.",
  "Mention in your own privacy notice that customer chats are handled by Nandzz on your behalf.",
  "Delete a customer's conversation here when they ask you to erase their data.",
];

const DATA_HANDLING = [
  "What is stored: messages (voice notes as text transcripts), the customer's WhatsApp name and number, and the bookings the agent makes.",
  "Who processes it: OpenAI writes the replies and transcribes voice notes; Cloudflare runs the agent; our database keeps the history.",
  "How long: for the retention period you pick in My Agent → Settings (at most 12 months), or until you delete it.",
  "Your role: you are the data controller for your customers' chats; Nandzz processes them only on your instructions, under the Data Processing Agreement.",
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
            {connection ? `Connected${connection.phone ? ` · ${connection.phone}` : ""}` : "Not connected"}
          </p>
        </div>
      </div>

      {connection ? <Connected connection={connection} /> : <NotConnected />}
    </div>
  );
}

function Connected({ connection }: { connection: WhatsAppConnection }) {
  return (
    <>
      <Section title="Your number is connected" description="The agent answers customers who write to this number. Every reply also shows up in the WhatsApp Business app on your phone.">
        <p className="text-sm text-muted-foreground">
          Connected on {new Date(connection.connectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
        </p>
      </Section>

      <Section title="Your responsibilities" description="You accepted these when you connected the number.">
        <BulletList items={RESPONSIBILITIES} />
        <LegalLinks />
      </Section>

      <Section title="Your customers' data">
        <BulletList items={DATA_HANDLING} />
      </Section>

      <DisconnectSection />
    </>
  );
}

function NotConnected() {
  return (
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
        <p className="mt-4 text-xs text-muted-foreground">
          By connecting, you agree to the WhatsApp Business Terms and Messaging Policy, and to the Nandzz Terms and Data
          Processing Agreement, under which Nandzz handles your customers&apos; messages on your behalf.
        </p>
      </Section>

      <Section title="Before you connect">
        <BulletList items={REQUIREMENTS} />
      </Section>

      <Section title="What you agree to">
        <BulletList items={RESPONSIBILITIES} />
        <div className="mt-4 border-t border-border/60 pt-4">
          <BulletList items={DATA_HANDLING} />
        </div>
        <LegalLinks />
      </Section>
    </>
  );
}

function DisconnectSection() {
  const router = useRouter();
  const [deleteHistory, setDeleteHistory] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = async () => {
    setError(null);
    const res = await disconnectWhatsApp({ deleteHistory });
    if (!res.ok && res.error !== "NOT_FOUND") {
      setError("Couldn't disconnect the number. Please try again.");
      return;
    }
    router.refresh();
  };

  return (
    <Section
      title="Disconnect this number"
      description="The agent stops answering at once and forgets its chats. Your number and the WhatsApp Business app on your phone keep working as before."
      className="border-destructive/30"
    >
      <label className="mb-4 flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={deleteHistory}
          onChange={(e) => setDeleteHistory(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-destructive"
        />
        <span>
          Also delete all conversations and activity
          <span className="block text-xs text-muted-foreground">
            Otherwise they stay visible here until your retention period ends. Bookings stay in your calendar either way.
          </span>
        </span>
      </label>
      <Button variant="destructive" className="h-10" onClick={() => setConfirming(true)}>
        <Unplug aria-hidden /> Disconnect
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={disconnect}
        title="Disconnect WhatsApp?"
        description={
          deleteHistory
            ? "The agent stops answering and every conversation and activity entry is deleted for good."
            : "The agent stops answering. Conversations and activity stay until your retention period ends."
        }
        confirmLabel="Disconnect"
        cancelLabel="Cancel"
      />
    </Section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function LegalLinks() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-sm">
      {META_TERMS.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          {l.label} <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </a>
      ))}
      {NANDZZ_TERMS.map((l) => (
        <Link key={l.href} href={l.href} className="font-medium underline-offset-4 hover:underline">
          {l.label}
        </Link>
      ))}
    </div>
  );
}
