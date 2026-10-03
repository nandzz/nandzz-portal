// Booking message helpers: time formatting + wrapping owner-authored plain-text
// templates into a simple, email-client-safe HTML body. The actual copy now
// comes from owner-customizable templates (see lib/widgets/messages.ts).

export function formatBookingTime(startsAt: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(startsAt));
  } catch {
    return new Date(startsAt).toUTCString();
  }
}
