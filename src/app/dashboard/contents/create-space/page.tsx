export const dynamic = 'force-dynamic';

import Link from "next/link";
import { redirect } from "next/navigation";
import { Rocket } from "lucide-react";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CONTENT_TYPES, getContentTypeLabel, getContentTypeDescription } from "@/lib/spaces/content-types";
import { getServerTranslations } from "@/lib/i18n/server";

const CREATABLE_TYPES = Object.values(CONTENT_TYPES).filter((t) => t.creatable);

export default async function CreateSpacePage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);

  if (!userId) {
    redirect("/login");
  }

  const { collectionId } = await searchParams;
  const t = await getServerTranslations();

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>
      <div className="mx-auto flex max-w-7xl justify-center px-4 py-12">
        <Card className="w-full max-w-2xl shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                <Rocket className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-xl">{t.contentPicker.title}</CardTitle>
                <CardDescription>{t.contentPicker.subtitle}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CREATABLE_TYPES.map(({ id, icon: Icon }) => (
                <Link
                  key={id}
                  href={
                    collectionId
                      ? `/dashboard/contents/create-space/${id}?collectionId=${collectionId}`
                      : `/dashboard/contents/create-space/${id}`
                  }
                  className="relative rounded-xl border-2 border-border/60 px-3 py-3 text-left transition-all hover:border-violet-500/30 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-semibold text-sm">{getContentTypeLabel(t, id)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground leading-snug">{getContentTypeDescription(t, id)}</div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
