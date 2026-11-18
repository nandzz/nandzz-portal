export const dynamic = 'force-dynamic';

import { redirect, notFound } from "next/navigation";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { BUILDER_REGISTRY, type CreatableContentTypeId } from "@/features/spaces";

function isCreatableType(type: string): type is CreatableContentTypeId {
  return Object.prototype.hasOwnProperty.call(BUILDER_REGISTRY, type);
}

export default async function CreateSpaceTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);

  if (!userId) {
    redirect("/login");
  }

  const { type } = await params;
  // The video builder was merged into `link`; keep old `/video` links working.
  const resolvedType = type === "video" ? "link" : type;
  if (!isCreatableType(resolvedType)) {
    notFound();
  }

  const { collectionId } = await searchParams;
  const Builder = BUILDER_REGISTRY[resolvedType].component;

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>
      <div className="mx-auto flex max-w-7xl justify-center px-4 py-12">
        <Builder collectionId={collectionId} />
      </div>
    </div>
  );
}
