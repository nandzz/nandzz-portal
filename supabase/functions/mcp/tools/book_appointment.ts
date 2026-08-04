import type { ToolDefinition, ToolHandler } from "./types.ts";
import { resolveOwnerCalendar } from "./_calendar.ts";

export const bookAppointmentDef: ToolDefinition = {
  name: "book_appointment",
  description:
    "Create a booking on the caller's calendar widget. Call list_availability first to get a valid start time. Availability, entitlement and double-booking are all enforced server-side; a taken or out-of-hours slot returns an error.",
  inputSchema: {
    type: "object",
    properties: {
      service_id: { type: "string", description: "The service id (from the services list)." },
      starts_at: { type: "string", description: "Start time, ISO-8601 UTC (e.g. 2026-08-10T14:00:00Z), from list_availability." },
      customer_name: { type: "string", description: "The customer's full name." },
      customer_email: { type: "string", description: "The customer's email address." },
      customer_phone: { type: "string", description: "Optional phone number." },
      notes: { type: "string", description: "Optional notes for the appointment." },
    },
    required: ["service_id", "starts_at", "customer_name", "customer_email"],
    additionalProperties: false,
  },
};

const ERROR_HINTS: Record<string, string> = {
  NO_ACCESS: "The calendar widget has no active subscription.",
  SLOT_TAKEN: "That slot was already booked. Call list_availability again.",
  OUT_OF_HOURS: "That time is outside available hours. Pick a slot from list_availability.",
  BLACKOUT: "That date is blacked out. Pick another day.",
  INVALID_SERVICE: "Unknown service_id.",
  WIDGET_UNAVAILABLE: "The calendar widget is not available.",
};

export const bookAppointment: ToolHandler = async (args, { admin, userId }) => {
  const calendar = await resolveOwnerCalendar(admin, userId);
  if (!calendar) {
    return {
      content: [{ type: "text", text: "No active calendar booking widget was found on your account." }],
      isError: true,
    };
  }

  // create_booking_tx returns a single widget_bookings row (composite, not
  // setof) — PostgREST hands it back as an object, so no .single() needed.
  const { data: booking, error } = await admin.rpc("create_booking_tx", {
    p_instance_id: calendar.id,
    p_service_id: String(args.service_id ?? ""),
    p_starts_at: String(args.starts_at ?? ""),
    p_customer_name: String(args.customer_name ?? ""),
    p_customer_email: String(args.customer_email ?? ""),
    p_customer_phone: args.customer_phone ? String(args.customer_phone) : null,
    p_notes: args.notes ? String(args.notes) : null,
    p_created_by: userId,
  });

  if (error || !booking) {
    const code = Object.keys(ERROR_HINTS).find((c) => error?.message?.includes(c));
    return {
      content: [{ type: "text", text: `Booking failed: ${code ? ERROR_HINTS[code] : error?.message ?? "unknown error"}` }],
      isError: true,
    };
  }

  const b = booking as { id: string; service_name: string; starts_at: string; ends_at: string; customer_name: string };
  return {
    content: [
      {
        type: "text",
        text: `Booked ${b.service_name} for ${b.customer_name} at ${b.starts_at} (times in ${calendar.config.timezone}).`,
      },
    ],
    structuredContent: {
      booking: { id: b.id, service_name: b.service_name, starts_at: b.starts_at, ends_at: b.ends_at },
    },
  };
};
