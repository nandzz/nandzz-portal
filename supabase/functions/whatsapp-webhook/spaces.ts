import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AdminClient = ReturnType<typeof createClient>;

export interface SpaceRecord {
  user_id: string;
  title: string;
  description: string;
  preview_title: string;
  is_public: boolean;
  likes_count: number;
  views_count: number;
  hashtags: string[];
  url?: string;
  image_url?: string;
  pdf_url?: string;
  html_url?: string;
  markdown_content?: string;
}

export async function createSpace(
  admin: AdminClient,
  record: SpaceRecord,
): Promise<string | null> {
  const { data, error } = await admin
    .from("spaces")
    .insert(record)
    .select("id")
    .single();

  if (error) {
    console.log("[spaces] insert error:", error.message);
    return null;
  }
  return data.id;
}

async function findOrCreateUpdatesCollection(
  admin: AdminClient,
  userId: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from("collections")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Updates")
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("collections")
    .insert({ user_id: userId, name: "Updates", is_public: true })
    .select("id")
    .single();

  if (error) {
    console.log("[collections] failed to create Updates collection:", error.message);
    return null;
  }
  return created.id;
}

export async function addToUpdatesCollection(
  admin: AdminClient,
  userId: string,
  spaceId: string,
): Promise<void> {
  const collectionId = await findOrCreateUpdatesCollection(admin, userId);
  if (!collectionId) return;

  const { error } = await admin
    .from("collection_spaces")
    .insert({ collection_id: collectionId, space_id: spaceId });

  if (error) {
    console.log("[collections] add to Updates error:", error.message);
  }
}
