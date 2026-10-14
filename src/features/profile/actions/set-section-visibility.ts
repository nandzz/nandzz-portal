"use server";

import { createClient } from "@/lib/supabase/server";
import { SECTION_VISIBILITY_COLUMN } from "@/lib/spaces/content-types";
import { setSectionVisibilitySchema } from "../schemas";
import { revalidatePublicProfile } from "../revalidate";

export type SetSectionVisibilityResult =
  | { ok: true }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED";
      message?: string;
    };

// Toggles whether one profile section (informative / gallery / links) shows on
// the public profile. Scoped to the caller's own row via `.eq("id", user.id)`,
// so the client never passes a profile id. Revalidates the public profile
// itself so visitors never keep seeing a section the owner just hid.
export async function setSectionVisibility(input: {
  section: string;
  value: boolean;
}): Promise<SetSectionVisibilityResult> {
  const parsed = setSectionVisibilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { section, value } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ [SECTION_VISIBILITY_COLUMN[section]]: value })
    .eq("id", user.id)
    .select("username")
    .single();
  if (error) return { ok: false, error: "FAILED", message: error.message };

  revalidatePublicProfile(data?.username);
  return { ok: true };
}
