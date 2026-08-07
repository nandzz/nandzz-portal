export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOwnerWidgetById } from "@/lib/widgets/server";
import { renderWidgetIcon } from "@/components/widgets/widgetIcon";
import { WidgetInstanceSettings } from "@/components/widgets/calendar/WidgetInstanceSettings";
import { getServerTranslations } from "@/lib/i18n/server";

export default async function WidgetInstanceSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const widget = await getOwnerWidgetById(user.id, id);
  if (!widget) notFound();

  const t = await getServerTranslations();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/dashboard/widgets/${id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {t.booking.backToWidgetLink}
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
          {renderWidgetIcon(widget.catalog.icon, "h-5 w-5 text-emerald-600 dark:text-emerald-400")}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.booking.widgetSettingsTitle}</h1>
          <p className="text-sm text-muted-foreground">{widget.catalog.name}</p>
        </div>
      </div>

      <WidgetInstanceSettings
        instanceId={widget.id}
        catalogId={widget.catalog_id}
        hasAccess={widget.has_access}
        initialEnabled={widget.enabled}
      />
    </div>
  );
}
