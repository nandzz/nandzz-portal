// My Agent (Business Agent) view models, all backed by real data.

import type { WeekdayKey } from "@/lib/types";

export type ActivityKind = "booking_created" | "approval" | "handoff" | "rescheduled" | "cancelled" | "rule" | "error";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  customer: string;
  phone: string;
  title: string;
  detail: string;
  /** Why the agent did it — the rule or reasoning shown in the feed. */
  reason?: string;
  at: string; // ISO
  /** Pending approvals only: what the owner approves or rejects. */
  pending?: { service: string; when: string; staff: string };
};

export type ConversationState = "handling" | "handed_off" | "taken_over";

export type ChatMessage = {
  id: string;
  from: "customer" | "agent" | "owner";
  /** Voice notes carry their transcript. */
  text: string;
  at: string; // ISO
  voice?: boolean;
};

export type Conversation = {
  id: string;
  customer: string;
  phone: string;
  state: ConversationState;
  /** Owner takeover: when the agent resumes (ISO). */
  resumesAt?: string;
  updatedAt: string; // ISO
  messages: ChatMessage[];
};

export type UsageSummary = {
  periodLabel: string;
  /** Customer messages the agent read this month. */
  inbound: number;
  /** Replies the agent sent this month. */
  replies: number;
  /** Served messages per day, last 14 days (oldest first). */
  daily: number[];
};

export type WhatsAppConnection = { phone: string | null; connectedAt: string };

// Mirrors agent_settings (one row per business). Answering questions is always
// on while the agent is enabled; booking actions carry an autonomy each.
export type Autonomy = "off" | "pending" | "confirm";

export type AutonomyCapability = "new_booking" | "reschedule" | "cancel";

export type WorkingDay = { day: WeekdayKey; enabled: boolean; from: string; to: string };

export type AgentSettings = {
  enabled: boolean;
  name: string;
  intro: string;
  autonomy: Record<AutonomyCapability, Autonomy>;
  /** false ⇒ around the clock (agent_hours null). */
  limitHours: boolean;
  hours: WorkingDay[];
  takeoverMinutes: number;
  retentionMonths: 1 | 3 | 6 | 12;
};

export type KnowledgeEntry = { id: string; title: string; body: string; updatedAt: string };
