import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapBookingError } from "@/lib/widgets/booking-errors";
import { bookingConfirmationEmail } from "@/lib/widgets/emails";
import { normalizeCalendarConfig } from "@/lib/widgets/calendar";
import { sendEmail } from "@/lib/email";
import type { WidgetBooking } from "@/lib/types";

// Public: create a booking. Entitlement, availability and overlap are enforced
// atomically in the create_booking_tx RPC. If the caller happens to be a
// logged-in Portal user, we record them as created_by.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params;
  const body = (await req.json()) as {
    service_id?: string;
    starts_at?: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    notes?: string;
  };

  if (!body.service_id || !body.starts_at || !body.customer_name || !body.customer_email) {
    return NextResponse.json(
      { error: "service_id, starts_at, customer_name and customer_email are required" },
      { status: 400 }
    );
  }

  // Best-effort: attribute the booking to a signed-in Portal user if there is one.
  let createdBy: string | null = null;
  try {
    const ssr = await createClient();
    const {
      data: { user },
    } = await ssr.auth.getUser();
    createdBy = user?.id ?? null;
  } catch {
    createdBy = null;
  }

  const admin = createAdminClient();

  const { data: booking, error } = await admin
    .rpc("create_booking_tx", {
      p_instance_id: instanceId,
      p_service_id: body.service_id,
      p_starts_at: body.starts_at,
      p_customer_name: body.customer_name,
      p_customer_email: body.customer_email,
      p_customer_phone: body.customer_phone ?? null,
      p_notes: body.notes ?? null,
      p_created_by: createdBy,
    })
    .single<WidgetBooking>();

  if (error || !booking) {
    const mapped = mapBookingError(error?.message);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  // Build the manage link + send a confirmation (fire-and-forget on failure).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const manageUrl = `${siteUrl}/booking/${booking.manage_token}`;

  const { data: instance } = await admin
    .from("widget_instances")
    .select("config, owner:profiles(display_name, username)")
    .eq("id", instanceId)
    .maybeSingle();

  const owner = instance?.owner as unknown as { display_name?: string; username?: string } | null;
  const businessName = owner?.display_name || owner?.username || "your provider";
  const timezone = normalizeCalendarConfig(instance?.config).timezone;

  const email = bookingConfirmationEmail({
    customerName: booking.customer_name,
    businessName,
    serviceName: booking.service_name,
    startsAt: booking.starts_at,
    timezone,
    manageUrl,
  });
  await sendEmail({ to: booking.customer_email, subject: email.subject, html: email.html });

  return NextResponse.json(
    {
      booking: {
        id: booking.id,
        service_name: booking.service_name,
        starts_at: booking.starts_at,
        ends_at: booking.ends_at,
      },
      manage_url: manageUrl,
    },
    { status: 201 }
  );
}
