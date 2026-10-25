// My Agent (Business Agent) view models. UI-only for now: every value comes
// from `mockData.ts` until the WhatsApp runtime and `agent_*` tables exist.

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

export type Autonomy = "off" | "answer" | "answer_handoff" | "pending" | "confirm" | "on";

export type Capability = {
  id: "answer" | "book" | "reschedule" | "cancel" | "lookup";
  label: string;
  hint: string;
  options: Autonomy[];
  value: Autonomy;
};

export type WorkingDay = { day: string; enabled: boolean; from: string; to: string };

export type AgentSettingsDraft = {
  name: string;
  intro: string;
  capabilities: Capability[];
  hours: WorkingDay[];
  takeoverMinutes: number;
  alerts: { email: boolean; whatsapp: boolean; inApp: boolean };
  retentionMonths: number;
};
