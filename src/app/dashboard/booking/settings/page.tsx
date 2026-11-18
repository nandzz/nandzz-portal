export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Eye, Globe } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";
import { getOrCreateOwnerCalendar } from "@/features/booking/server";
import { renderWidgetIcon, WidgetInstanceSettings, WebsiteEmbedCard } from "@/features/booking";
import { getServerTranslations } from "@/lib/i18n/server";

const SECTIONS = ["visibility", "website"] as const;
type Section = (typeof SECTIONS)[number];

export default async function BookingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  // `?section=website` deep-links a tab (e.g. from the guide or an email).
  const { section } = await searchParams;
  const initialSection: Section = SECTIONS.includes(section as Section) ? (section as Section) : "visibility";

  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login");

  // Business-only feature: personal accounts can't reach it by direct URL.
  if ((await getAccountType(supabase, userId)) !== "business") redirect("/dashboard/bookings");

  const widget = await getOrCreateOwnerCalendar(userId);
  if (!widget) notFound();

  const [t, { data: profile }] = await Promise.all([
    getServerTranslations(),
    supabase.from("profiles").select("username").eq("id", userId).maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/dashboard/booking"
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

      <Tabs defaultValue={initialSection} className="gap-6">
        <TabsList className="w-full">
          <TabsTrigger value="visibility" className="flex-1 gap-2">
            <Eye className="h-4 w-4" /> {t.booking.sectionVisibility}
          </TabsTrigger>
          <TabsTrigger value="website" className="flex-1 gap-2">
            <Globe className="h-4 w-4" /> {t.booking.embedTab}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visibility">
          <WidgetInstanceSettings
            instanceId={widget.id}
            hasAccess={widget.has_access}
            initialEnabled={widget.enabled}
          />
        </TabsContent>

        <TabsContent value="website">
          {profile?.username && (
            <WebsiteEmbedCard username={profile.username} live={widget.has_access && widget.enabled} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
