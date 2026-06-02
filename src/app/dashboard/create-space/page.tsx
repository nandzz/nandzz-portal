export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SpaceForm } from "@/components/spaces/SpaceForm";

export default async function CreateSpacePage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { collectionId } = await searchParams;

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>
      <div className="mx-auto flex max-w-7xl justify-center px-4 py-12">
        <SpaceForm collectionId={collectionId} />
      </div>
    </div>
  );
}
