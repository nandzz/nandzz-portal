import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await request.json();
  if (!username) {
    return Response.json({ error: "Missing username" }, { status: 400 });
  }

  // Tag invalidates the unstable_cache entry in app/[username]/(profile)/page.tsx;
  // path drops any route-level caches for the profile URL.
  revalidateTag(`profile:${username}`, "max");
  revalidatePath(`/${username}`);

  return Response.json({ revalidated: true });
}
