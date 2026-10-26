import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageSummary } from "../types";

// My Agent → Usage, real data: messages the agent served this month (customer
// messages it read + replies it sent; the owner's own replies don't count) and
// the last 14 days per day. Counted from agent_messages with the owner's client.

const DAYS = 14;

export async function loadMyAgentUsage(supabase: SupabaseClient, userId: string, now: number): Promise<UsageSummary> {
  const today = new Date(now);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const firstDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (DAYS - 1)));

  const count = (direction: "in" | "out") =>
    supabase
      .from("agent_messages")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", userId)
      .eq("direction", direction)
      .gte("created_at", monthStart.toISOString());

  const [{ count: inbound }, { count: replies }, { data: recent }] = await Promise.all([
    count("in"),
    count("out"),
    supabase
      .from("agent_messages")
      .select("created_at")
      .eq("owner_user_id", userId)
      .in("direction", ["in", "out"])
      .gte("created_at", firstDay.toISOString())
      .limit(20_000),
  ]);

  const daily = Array.from({ length: DAYS }, () => 0);
  for (const r of recent ?? []) {
    const day = Math.floor((new Date(r.created_at).getTime() - firstDay.getTime()) / 86_400_000);
    if (day >= 0 && day < DAYS) daily[day]++;
  }

  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(monthStart);
  return {
    periodLabel: `1–${today.getUTCDate()} ${month}`,
    inbound: inbound ?? 0,
    replies: replies ?? 0,
    daily,
  };
}
