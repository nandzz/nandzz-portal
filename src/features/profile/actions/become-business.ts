"use server";

import { createClient } from "@/lib/supabase/server";
import type { ProfileAddress } from "@/lib/types";
import { becomeBusinessSchema } from "../schemas";
import { revalidatePublicProfile } from "../revalidate";

export type BecomeBusinessResult =
  | { ok: true }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED";
      message?: string;
    };

// Flips the caller's own profile to a Business account together with its
// category and geocoded address, in ONE row update — the
// profiles_require_business_details trigger rejects the flip without them.
export async function becomeBusiness(input: {
  category: string;
  address: ProfileAddress;
}): Promise<BecomeBusinessResult> {
  const parsed = becomeBusinessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { category, address } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ account_type: "business", category, address })
    .eq("id", user.id)
    .select("username")
    .single();
  if (error) return { ok: false, error: "FAILED", message: error.message };

  revalidatePublicProfile(data?.username);
  return { ok: true };
}
