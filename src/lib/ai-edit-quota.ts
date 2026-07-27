import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const DAILY_LIMITS: Record<string, number> = {
  free: 5,
  pro: 50,
};

export async function checkAiEditQuota(
  userId: string,
  planTier: string | null | undefined
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = DAILY_LIMITS[planTier ?? "free"] ?? DAILY_LIMITS.free;
  const admin = createAdminClient();

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count, error } = await admin
    .from("ai_edit_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    // Fail open — don't block the user on a quota DB error
    return { allowed: true, remaining: limit };
  }

  const used = count ?? 0;
  return { allowed: used < limit, remaining: Math.max(0, limit - used) };
}
