import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCalendarConfig } from "@/lib/widgets/calendar";
import { ManageBooking, type ManageBookingData } from "@/components/widgets/calendar/ManageBooking";

export const dynamic = "force-dynamic";

// Public customer self-serve page. The manage_token in the URL is the sole
// authorization; the customer is typically not a logged-in Portal user.
export default async function BookingManagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("widget_bookings")
    .select("*, instance:widget_instances(config, owner:profiles(display_name, username))")
    .eq("manage_token", token)
    .maybeSingle();

  if (!data) notFound();

  const instance = (data as { instance?: { config?: unknown; owner?: { display_name?: string; username?: string } | null } })
    .instance;
  const owner = instance?.owner ?? null;

  const initial: ManageBookingData = {
    service_name: data.service_name as string,
    service_id: data.service_id as string,
    location_id: (data.location_id as string | null) ?? null,
    instance_id: data.instance_id as string,
    starts_at: data.starts_at as string,
    status: data.status as "confirmed" | "cancelled",
    business_name: owner?.display_name || owner?.username || "your provider",
    business_username: owner?.username ?? null,
    timezone: normalizeCalendarConfig(instance?.config).timezone,
    staff_name: (data.staff_name as string | null) ?? null,
  };

  return <ManageBooking token={token} initial={initial} />;
}
