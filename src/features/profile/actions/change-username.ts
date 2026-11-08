"use server";

import { createClient } from "@/lib/supabase/server";
import { changeUsernameSchema } from "../schemas";
import { revalidatePublicProfile } from "../revalidate";
import {
  USERNAME_CHANGE_WINDOW_DAYS,
  computeUsernameChangeStatus,
  type UsernameChangeStatus,
} from "../domain/username-change";

export type ChangeUsernameResult =
  | ({ ok: true; username: string } & UsernameChangeStatus)
  | {
      ok: false;
      error:
        | "UNAUTHENTICATED"
        | "INVALID_USERNAME"
        | "SAME_USERNAME"
        | "USERNAME_TAKEN"
        | "RATE_LIMITED"
        | "FAILED";
      message?: string;
    };

export type LoadUsernameChangeStatusResult =
  | ({ ok: true } & UsernameChangeStatus)
  | { ok: false; error: "UNAUTHENTICATED" | "FAILED" };

// Remaining changes for the settings card. RLS limits the read to own rows.
export async function loadUsernameChangeStatus(): Promise<LoadUsernameChangeStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const since = new Date(Date.now() - USERNAME_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("username_changes")
    .select("changed_at")
    .eq("profile_id", user.id)
    .gt("changed_at", since.toISOString());
  if (error) return { ok: false, error: "FAILED" };

  return { ok: true, ...computeUsernameChangeStatus((data ?? []).map((r) => r.changed_at)) };
}

// Renames the caller's profile through the `change_username` definer RPC (the
// only path end users have: profiles.username is a protected column). The RPC
// enforces the 2-per-60-days limit atomically.
export async function changeUsername(input: { username: string }): Promise<ChangeUsernameResult> {
  const parsed = changeUsernameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_USERNAME" };
  const { username } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data: before } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const { data, error } = await supabase.rpc("change_username", { p_username: username });
  if (error) {
    const known = ["INVALID_USERNAME", "SAME_USERNAME", "USERNAME_TAKEN", "RATE_LIMITED", "UNAUTHENTICATED"] as const;
    const code = known.find((k) => error.message?.includes(k));
    return code ? { ok: false, error: code } : { ok: false, error: "FAILED", message: error.message };
  }

  const row = data as { username: string; changes_left: number; next_change_at: string | null };
  // Old page now 404s/redirects, new page must render fresh.
  revalidatePublicProfile(before?.username);
  revalidatePublicProfile(row.username);

  return {
    ok: true,
    username: row.username,
    changesLeft: row.changes_left,
    nextChangeAt: row.next_change_at,
  };
}
