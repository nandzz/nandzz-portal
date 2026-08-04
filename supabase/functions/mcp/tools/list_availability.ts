import type { ToolDefinition, ToolHandler } from "./types.ts";
import { resolveOwnerCalendar, computeSlots, todayInZone } from "./_calendar.ts";

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

  const serviceId = String(args.service_id ?? "");
  const service = calendar.config.services.find((s) => s.id === serviceId);
  if (!service) {
    const list = calendar.config.services.map((s) => `${s.name} (id: ${s.id})`).join(", ");
    return {
      content: [{ type: "text", text: `Unknown service_id. Available services: ${list || "none configured"}.` }],
      isError: true,
    };
  }

  const days = Math.min(60, Math.max(1, Number(args.days ?? 14)));
  const fromDate = todayInZone(calendar.config.timezone);

  const { data: bookings } = await admin
    .from("widget_bookings")
    .select("starts_at, ends_at")
    .eq("instance_id", calendar.id)
    .eq("status", "confirmed");

  const slots = computeSlots(calendar.config, service, fromDate, days, bookings ?? []);

  return {
    content: [
      {
        type: "text",
        text:
          slots.length === 0
            ? `No open slots for ${service.name} in the next ${days} days.`
            : `Found ${slots.length} open slot(s) for ${service.name} (times in ${calendar.config.timezone}).`,
      },
    ],
    structuredContent: {
      timezone: calendar.config.timezone,
      service: { id: service.id, name: service.name, duration_min: service.duration_min },
      slots,
    },
  };
};
