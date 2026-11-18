export const dynamic = 'force-dynamic';

import { redirect, notFound } from "next/navigation";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { BUILDER_REGISTRY } from "@/features/spaces";
import { MetadataOnlyEditor } from "@/features/spaces";
import { resolveContentType } from "@/lib/spaces/content-types";

export default async function EditSpacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);

  if (!userId) {
    redirect("/login");
  }

  const { data: space } = await supabase
    .from("spaces")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!space) {
    notFound();
  }

  const contentType = resolveContentType(space);
  const Builder = contentType === "html" || contentType === "ai" ? MetadataOnlyEditor : BUILDER_REGISTRY[contentType].component;

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>
      <div className="mx-auto flex max-w-7xl justify-center px-4 py-12">
        <Builder space={space} />
      </div>
    </div>
  );
}
