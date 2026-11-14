// "Add to calendar" helpers for a confirmed booking.
//
// The .ics file is the only web format that carries custom alerts (VALARM):
// Apple Calendar (iPhone/Mac), Outlook and most desktop clients keep them.
// Google Calendar's "add event" link can't set reminders (it applies the
// user's defaults), and Google usually drops VALARM on .ics import too.

export type CalendarEvent = {
  uid: string;
  startIso: string;
  endIso: string;
  title: string;
  location?: string;
  description?: string;
  url?: string;
};

// Alert lead times, in minutes before the start (2 h and 1 h).
export const BOOKING_ALERT_MINUTES = [120, 60] as const;

// 2026-11-14T09:30:00.000Z → 20261114T093000Z
export function icsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// RFC 5545 §3.3.11 TEXT escaping.
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF + space.
// Splits on code points so a multi-byte character is never cut in half.
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    // Continuation lines start with a space, which counts toward the 75.
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildBookingIcs(event: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nandzz//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsUtc(now.toISOString())}`,
    `DTSTART:${icsUtc(event.startIso)}`,
    `DTEND:${icsUtc(event.endIso)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push("STATUS:CONFIRMED");
  for (const minutes of BOOKING_ALERT_MINUTES) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(event.title)}`,
      `TRIGGER:-PT${minutes}M`,
      "END:VALARM"
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(event: Omit<CalendarEvent, "uid" | "url">): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${icsUtc(event.startIso)}/${icsUtc(event.endIso)}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
