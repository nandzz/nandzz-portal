import type { AvailabilityWindows, WeekdayKey } from "@/lib/types";
import type { AgentSettings, Autonomy, AutonomyCapability, WorkingDay } from "./types";

// agent_settings row ↔ the Settings tab model. Shared by the loader and the
// save action so both sides agree on defaults and limits (they match the
// table's checks in the agent_core / agent_settings_retention migrations).

export const WEEKDAYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const AUTONOMY_CAPABILITIES: AutonomyCapability[] = ["new_booking", "reschedule", "cancel"];
export const RETENTION_MONTHS = [1, 3, 6, 12] as const;
export const LIMITS = { name: 40, intro: 200, takeoverMin: 1, takeoverMax: 240 } as const;

export type AgentSettingsRow = {
  enabled: boolean;
  agent_name: string;
  agent_intro: string;
  autonomy: Partial<Record<AutonomyCapability, string>> | null;
  agent_hours: AvailabilityWindows | null;
  takeover_pause_min: number;
  retention_months: number;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const AUTONOMY: Autonomy[] = ["off", "pending", "confirm"];

const DEFAULT_DAY = (day: WeekdayKey): WorkingDay => ({
  day,
  enabled: day !== "sun",
  from: "09:00",
  to: "19:00",
});

export function settingsFromRow(row: AgentSettingsRow | null): AgentSettings {
  const hours = row?.agent_hours ?? null;
  return {
    enabled: row?.enabled ?? false,
    name: row?.agent_name ?? "Assistant",
    intro: row?.agent_intro ?? "",
    autonomy: Object.fromEntries(
      AUTONOMY_CAPABILITIES.map((c) => {
        const v = row?.autonomy?.[c] as Autonomy | undefined;
        return [c, v && AUTONOMY.includes(v) ? v : "pending"];
      }),
    ) as AgentSettings["autonomy"],
    limitHours: hours !== null,
    // One range per day in the UI; a day stored with several windows shows as
    // first start → last end.
    hours: WEEKDAYS.map((day) => {
      if (!hours) return DEFAULT_DAY(day);
      const windows = hours[day] ?? [];
      if (windows.length === 0) return { ...DEFAULT_DAY(day), enabled: false };
      return { day, enabled: true, from: windows[0][0], to: windows[windows.length - 1][1] };
    }),
    takeoverMinutes: row?.takeover_pause_min ?? 5,
    retentionMonths: (RETENTION_MONTHS as readonly number[]).includes(row?.retention_months ?? 0)
      ? (row!.retention_months as AgentSettings["retentionMonths"])
      : 6,
  };
}

/** Validates the tab model and maps it to columns; null when anything is off. */
export function rowFromSettings(s: AgentSettings): Omit<AgentSettingsRow, "enabled"> | null {
  const name = typeof s?.name === "string" ? s.name.trim() : "";
  // The worker prompt reads "You are {name}, {intro}, replying…", so drop a
  // trailing full stop / comma the owner may type.
  const intro = typeof s?.intro === "string" ? s.intro.trim().replace(/[\s.,;:]+$/, "") : "";
  if (name.length < 1 || name.length > LIMITS.name || intro.length > LIMITS.intro) return null;
  if (!AUTONOMY_CAPABILITIES.every((c) => AUTONOMY.includes(s.autonomy?.[c]))) return null;
  if (!Number.isInteger(s.takeoverMinutes) || s.takeoverMinutes < LIMITS.takeoverMin || s.takeoverMinutes > LIMITS.takeoverMax) {
    return null;
  }
  if (!(RETENTION_MONTHS as readonly number[]).includes(s.retentionMonths)) return null;

  let agentHours: AvailabilityWindows | null = null;
  if (s.limitHours) {
    if (!Array.isArray(s.hours) || s.hours.length !== WEEKDAYS.length) return null;
    agentHours = {};
    for (const day of WEEKDAYS) {
      const h = s.hours.find((x) => x?.day === day);
      if (!h || typeof h.enabled !== "boolean") return null;
      if (!h.enabled) continue;
      if (typeof h.from !== "string" || typeof h.to !== "string") return null;
      if (!TIME_RE.test(h.from) || !TIME_RE.test(h.to) || h.from >= h.to) return null;
      agentHours[day] = [[h.from, h.to]];
    }
  }

  return {
    agent_name: name,
    agent_intro: intro,
    // Only the known capabilities, never whatever else the client sent.
    autonomy: Object.fromEntries(AUTONOMY_CAPABILITIES.map((c) => [c, s.autonomy[c]])) as AgentSettings["autonomy"],
    agent_hours: agentHours,
    takeover_pause_min: s.takeoverMinutes,
    retention_months: s.retentionMonths,
  };
}
