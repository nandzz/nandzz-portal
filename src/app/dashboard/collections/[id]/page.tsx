export const dynamic = 'force-dynamic';

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SpaceGrid } from "@/components/spaces/SpaceGrid";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { CollectionActions } from "./CollectionActions";
import type { Space } from "@/lib/types";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: collection } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!collection) {
    notFound();
  }

  const [{ data: collectionSpaces }, { data: profile }] = await Promise.all([
    supabase
      .from("collection_spaces")
      .select("space_id, spaces(*)")
      .eq("collection_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single(),
  ]);

  const spaces: Space[] = (collectionSpaces || [])
    .map((cs) => cs.spaces as unknown as Space)
    .filter(Boolean);

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* Back link */}
        <Link
          href="/dashboard/collections"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Collections
        </Link>

        {/* Header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                <FolderOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{collection.name}</h1>
            </div>
            {collection.description && (
              <p className="mt-2 text-muted-foreground text-lg">{collection.description}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {spaces.length} {spaces.length === 1 ? "space" : "spaces"} ·{" "}
              {collection.is_public ? "Public" : "Private"}
            </p>
          </div>
          <CollectionActions collection={collection} />
        </div>

        <SpaceGrid
          spaces={spaces}
          editable
          showCreateCard
          collectionId={id}
          currentUserId={user.id}
          ownerUsername={profile?.username || undefined}
        />
      </div>
    </div>
  );
}
