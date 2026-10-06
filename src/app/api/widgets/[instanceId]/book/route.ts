import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOOKING_ERROR_STATUS, mapBookingError } from "@/features/booking/domain/booking-errors";
import { normalizeCalendarConfig, resolveSegmentPlan, type ServiceChoice } from "@/features/booking/domain/calendar";
import { detectLocale, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/translations";
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
    service_ids?: string[];
    starts_at?: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    customer_address?: string;
    notes?: string;
    // Legacy single-staff choice ("" ⇒ any). Kept for back-compat.
    staff_id?: string | null;
    // Per-service staff choice: { serviceId: staffId | "" }. "" / absent ⇒ any
    // available (auto-assigned). Preferred over `staff_id` when present.
    staff_by_service?: Record<string, string>;
    location_id?: string | null;
    locale?: string;
    // Booking-funnel consent to a WhatsApp reminder before the appointment.
    whatsapp_opt_in?: boolean;
  };

  // Multi-service: prefer the explicit list, falling back to the single
  // `service_id` (legacy / AI path). The RPC sums their durations + prices.
  const serviceIds = (
    Array.isArray(body.service_ids) && body.service_ids.length > 0
      ? body.service_ids
      : body.service_id
        ? [body.service_id]
        : []
  )
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);

  // The public web form and the owner's manual-booking flow both require a name
  // and phone; email is optional (a client who phones in may not give one — the
  // RPC stores '' and the confirmation email is skipped when it's absent). The
  // MCP/AI programmatic path stays lenient on phone — see create_booking_tx,
  // which keeps customer_phone nullable.
  if (
    serviceIds.length === 0 ||
    !body.starts_at ||
    !body.customer_name?.trim() ||
    !body.customer_phone?.trim()
  ) {
    return NextResponse.json(
      { error: "service_id, starts_at, customer_name and customer_phone are required" },
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

  // Capture the booker's language so the DB-trigger email localizes to it.
  // Prefer the locale the widget was actually displayed in (the customer's
  // picker choice / nandzz-lang cookie, sent in the body) over Accept-Language,
  // which reflects the browser build, not the language the booker used (e.g. an
  // English-installed browser used to book in Italian).
  const bodyLocale =
    typeof body.locale === "string" && SUPPORTED_LOCALES.includes(body.locale as Locale)
      ? (body.locale as Locale)
      : null;
  const locale = bodyLocale ?? detectLocale(req.headers.get("accept-language") ?? "");

  // Resolve the concrete per-service segment plan (which staff does which
  // service, in which sub-window) from the visitor's choices, then hand it to
  // create_booking_tx. Availability + eligibility are validated here; the RPC's
  // exclusion constraint is the final concurrency arbiter. Falls back cleanly to
  // a single unstaffed / auto-assigned segment when the business has no staff.
  const { data: instance } = await admin
    .from("widget_instances")
    .select("config, owner:profiles(display_name, username)")
    .eq("id", instanceId)
    .maybeSingle();
  if (!instance) {
    return NextResponse.json({ error: "WIDGET_UNAVAILABLE" }, { status: 404 });
  }
  const config = normalizeCalendarConfig(instance.config);
  const locationId = body.location_id ?? null;
  const location = locationId ? config.locations.find((l) => l.id === locationId) : undefined;
  if (locationId && !location) {
    return NextResponse.json({ error: "INVALID_LOCATION" }, { status: 400 });
  }
  const scopeServices = location ? location.services : config.services;
  const resolvedServices = serviceIds.map((id) => scopeServices.find((s) => s.id === id));
  if (resolvedServices.some((s) => !s)) {
    return NextResponse.json({ error: "INVALID_SERVICE" }, { status: 400 });
  }
  const staffByService = body.staff_by_service ?? {};
  const choices: ServiceChoice[] = (resolvedServices as NonNullable<(typeof resolvedServices)[number]>[]).map(
    (s) => ({
      service: s,
      // Prefer the per-service map; fall back to the legacy single `staff_id`
      // (applied to every service) so old callers keep working.
      staffId: staffByService[s.id] || body.staff_id || undefined,
    })
  );

  // Existing confirmed segments around the requested start, scoped to the
  // location bucket (same rule as the availability route).
  const startMs = new Date(body.starts_at).getTime();
  let busyQuery = admin
    .from("widget_booking_segments")
    .select("staff_id, starts_at, ends_at")
    .eq("instance_id", instanceId)
    .eq("status", "confirmed")
    .gte("starts_at", new Date(startMs - 2 * 86_400_000).toISOString())
    .lte("starts_at", new Date(startMs + 2 * 86_400_000).toISOString());
  busyQuery = location ? busyQuery.eq("location_id", location.id) : busyQuery.is("location_id", null);
  const { data: busy } = await busyQuery;

  const plan = resolveSegmentPlan({
    config,
    choices,
    startIso: new Date(body.starts_at).toISOString(),
    existingBusy: busy ?? [],
    location,
  });
  if (!plan.ok) {
    return NextResponse.json({ error: plan.reason }, { status: BOOKING_ERROR_STATUS[plan.reason] ?? 409 });
  }

  const { data: booking, error } = await admin
    .rpc("create_booking_tx", {
      p_instance_id: instanceId,
      p_service_id: serviceIds[0],
      p_service_ids: serviceIds,
      p_starts_at: body.starts_at,
      p_customer_name: body.customer_name,
      p_customer_email: body.customer_email?.trim() || null,
      p_customer_phone: body.customer_phone ?? null,
      p_customer_address: body.customer_address?.trim() || null,
      p_notes: body.notes ?? null,
      p_created_by: createdBy,
      p_staff_id: body.staff_id ?? null,
      p_location_id: locationId,
      p_locale: locale,
      p_segments: plan.segments,
    })
    .single<WidgetBooking>();

  if (error || !booking) {
    console.error("[widgets/book] create_booking_tx failed:", error);
    const mapped = mapBookingError(error?.message);
    return NextResponse.json({ error: mapped.code }, { status: mapped.status });
  }

  // Confirmation email goes out via the DB insert trigger → edge function.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const manageUrl = `${siteUrl}/booking/${booking.manage_token}`;

  // Persist the customer's WhatsApp-reminder consent (the ~4h reminder is sent
  // by the booking-notifications edge function). A separate update rather than
  // another create_booking_tx param: the reminder only fires hours later, so it
  // needn't be atomic with the insert. Only an explicit `true` opts in — owner
  // manual and AI bookings never message without consent.
  if (body.whatsapp_opt_in === true && booking.customer_phone) {
    const { error: optInError } = await admin
      .from("widget_bookings")
      .update({ whatsapp_opt_in: true })
      .eq("id", booking.id);
    if (optInError) console.error("[widgets/book] whatsapp_opt_in update failed:", optInError);
  }

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
