import type { ToolDefinition, ToolHandler } from "./types.ts";
import { addDays, computeSlots, pickService, resolveOwnerCalendar, todayInZone } from "./_calendar.ts";

export const listAvailabilityDef: ToolDefinition = {
  name: "list_availability",
  description:
    "List open appointment slots for the caller's calendar booking widget. Call this before book_appointment to find a valid start time. Returns ISO-8601 UTC start times.",
  inputSchema: {
    type: "object",
    properties: {
      service_id: {
        type: "string",
        description: "The service to check availability for. Use the id from the services list.",
      },
      location_id: {
        type: "string",
        description: "The location offering the service, when the business has several locations.",
      },
      days: {
        type: "number",
        description: "How many days ahead to search (default 14, max 60).",
      },
    },
    required: ["service_id"],
    additionalProperties: false,
  },
};

export const listAvailability: ToolHandler = async (args, { admin, userId }) => {
  const calendar = await resolveOwnerCalendar(admin, userId);
  if (!calendar) {
    return {
      content: [{ type: "text", text: "No active calendar booking widget was found on your account." }],
      isError: true,
    };
  }

  const picked = pickService(
    calendar.config,
    String(args.service_id ?? ""),
    args.location_id ? String(args.location_id) : null,
  );
  if (!picked.ok) {
    return { content: [{ type: "text", text: picked.message }], isError: true };
  }
  const { scope, service } = picked.match;

  const days = Math.min(60, Math.max(1, Number(args.days ?? 14)));
  const fromDate = todayInZone(scope.timezone);

  // Confirmed segments in the same resource bucket as the booking would land in
  // (the location, or the top level). A day of margin each side covers zones
  // far from UTC and segments that straddle the window edges.
  let busyQuery = admin
    .from("widget_booking_segments")
    .select("staff_id, starts_at, ends_at")
    .eq("instance_id", calendar.id)
    .eq("status", "confirmed")
    .gte("starts_at", `${addDays(fromDate, -1)}T00:00:00Z`)
    .lte("starts_at", `${addDays(fromDate, days + 1)}T00:00:00Z`);
  busyQuery = scope.locationId ? busyQuery.eq("location_id", scope.locationId) : busyQuery.is("location_id", null);
  const { data: busy } = await busyQuery;

  const slots = computeSlots(scope, calendar.config.buffer_min, service, fromDate, days, busy ?? []);

  return {
    content: [
      {
        type: "text",
        text:
          slots.length === 0
            ? `No open slots for ${service.name} in the next ${days} days.`
            : `Found ${slots.length} open slot(s) for ${service.name} (times in ${scope.timezone}).`,
      },
    ],
    structuredContent: {
      timezone: scope.timezone,
      service: { id: service.id, name: service.name, duration_min: service.duration_min },
      location: scope.locationId ? { id: scope.locationId, name: scope.locationName } : null,
      slots,
    },
  };
};
