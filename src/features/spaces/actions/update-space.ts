"use server";

import { createClient } from "@/lib/supabase/server";
import { updateSpaceSchema } from "../schemas";

export type UpdateSpaceResult =
  | { ok: true }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED";
      message?: string;
    };

// In-place edit of an existing space row (markdown save, HTML preview refresh,
// and the content-builder edit path). This stays a
// plain RLS-guarded update rather than going through `publish_space_tx`. RLS
// ensures the caller can only update rows they own; the `auth.getUser()` check
// is defense-in-depth.
export async function updateSpace(
  input: unknown
): Promise<UpdateSpaceResult> {
  const parsed = updateSpaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { id, ...fields } = parsed.data;
  if (Object.keys(fields).length === 0) return { ok: true };

  const { error } = await supabase.from("spaces").update(fields).eq("id", id);
  if (error) return { ok: false, error: "FAILED", message: error.message };

  return { ok: true };
}
