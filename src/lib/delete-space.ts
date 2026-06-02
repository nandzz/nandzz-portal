import type { SupabaseClient } from "@supabase/supabase-js";

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length).split("?")[0];
}

export async function deleteSpaceWithCleanup(
  supabase: SupabaseClient,
  spaceId: string
): Promise<void> {
  const { data: space } = await supabase
    .from("spaces")
    .select("preview_image_url, html_url, pdf_url")
    .eq("id", spaceId)
    .single();

  if (space) {
    const removals: Promise<unknown>[] = [];

    if (space.preview_image_url) {
      const path = extractStoragePath(space.preview_image_url, "space-previews");
      if (path) removals.push(supabase.storage.from("space-previews").remove([path]));
    }
    if (space.html_url) {
      const path = extractStoragePath(space.html_url, "space-html");
      if (path) removals.push(supabase.storage.from("space-html").remove([path]));
    }
    if (space.pdf_url) {
      const path = extractStoragePath(space.pdf_url, "space-pdfs");
      if (path) removals.push(supabase.storage.from("space-pdfs").remove([path]));
    }

    await Promise.all(removals);
  }

  await supabase.from("spaces").delete().eq("id", spaceId);
}
