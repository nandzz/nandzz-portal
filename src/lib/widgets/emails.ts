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

// Wrap a rendered plain-text message into a minimal HTML email. WhatsApp-style
// *bold* is honored; newlines become <br>; bare URLs become links.
export function simpleEmailHtml(text: string): string {
  const escaped = escapeHtml(text);
  const withBold = escaped.replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>");
  const linked = withBold.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#059669;text-decoration:underline">$1</a>'
  );
  const html = linked.replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111;font-size:15px;line-height:1.6">${html}</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
