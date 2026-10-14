"use server";

import { revalidatePath } from "next/cache";

/** Invalidates cached routes after client-driven space writes (edit save,
 * batch image publish) so the follow-up `router.push` lands on fresh data.
 * Use this instead of `router.refresh()` right after `router.push()` — the
 * refresh targets the *current* (form) route and cancels the navigation. */
export async function revalidateContents(): Promise<void> {
  revalidatePath("/", "layout");
}
