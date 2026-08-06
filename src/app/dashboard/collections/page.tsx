export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FolderOpen, Layers } from "lucide-react";
import { NewCollectionForm } from "./NewCollectionForm";
import type { CollectionWithCount } from "@/lib/types";
import { getServerTranslations } from "@/lib/i18n/server";
import { PageShell } from "@/components/layout/PageShell";

export default async function CollectionsPage() {
  const supabase = await createClient();
  const t = await getServerTranslations();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: collections } = await supabase
    .from("collections")
    .select("*, collection_spaces(id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>

      <PageShell width="content">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                <Layers className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{t.collections.title}</h1>
            </div>
            <p className="mt-2 text-muted-foreground text-lg">
              {t.collections.subtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Collection list */}
          <div className="lg:col-span-2">
            {collections && collections.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(collections as CollectionWithCount[]).map((col) => {
                  const count = col.collection_spaces.length;
                  const spaceLabel = count === 1 ? t.collections.spaceSingular : t.collections.spacePlural;
                  const visibilityLabel = col.is_public ? t.collections.public : t.collections.private;
                  return (
                    <Link key={col.id} href={`/dashboard/collections/${col.id}`}>
                      <Card className="group h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-1 border-border/60 dark:border-border/80 dark:hover:border-violet-500/20 p-0">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100/80 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800 group-hover:bg-violet-200/80 dark:group-hover:bg-violet-800/50 transition-colors">
                              <FolderOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                                {col.name}
                              </h3>
                              {col.description && (
                                <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                                  {col.description}
                                </p>
                              )}
                              <p className="mt-2 text-xs text-muted-foreground">
                                {count} {spaceLabel}
                                {" · "}
                                {visibilityLabel}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/60 rounded-2xl">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100/80 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800">
                  <FolderOpen className="h-8 w-8 text-violet-400 dark:text-violet-500" />
                </div>
                <h2 className="text-lg font-semibold mb-1">{t.collections.noTitle}</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  {t.collections.noDesc}
                </p>
              </div>
            )}
          </div>

          {/* Create form */}
          <div>
            <NewCollectionForm />
          </div>
        </div>
      </PageShell>
    </div>
  );
}
