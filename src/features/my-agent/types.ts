// My Agent (Business Agent) view models. Activity, Settings and Knowledge are
// real data; the other tabs still come from `mockData.ts`.

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

export type ConversationState = "handling" | "waiting" | "taken_over" | "suspended";

export type ChatMessage = {
  id: string;
  from: "customer" | "agent" | "owner";
  text: string;
  at: string; // ISO
  voice?: { seconds: number };
};

export type Conversation = {
  id: string;
  customer: string;
  phone: string;
  state: ConversationState;
  intent: string;
  language: string;
  /** Owner takeover: when the agent resumes (ISO). */
  resumesAt?: string;
  updatedAt: string; // ISO
  messages: ChatMessage[];
};

export type RuleAction = "send_message" | "alert_owner" | "pending_booking" | "hand_off" | "suspend_chat";

export type Workflow = {
  id: string;
  builtIn: boolean;
  when: string;
  action: RuleAction;
  /** send_message only: what the agent says. */
  message?: string;
  enabled: boolean;
  firedThisMonth: number;
};

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
