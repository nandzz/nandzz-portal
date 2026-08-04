// Booking-related email bodies. Plain, self-contained HTML (email clients strip
// most CSS) — kept here so the send sites stay tidy.

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

export function bookingConfirmationEmail(input: {
  customerName: string;
  businessName: string;
  serviceName: string;
  startsAt: string;
  timezone: string;
  manageUrl: string;
}): { subject: string; html: string } {
  const when = formatBookingTime(input.startsAt, input.timezone);
  const subject = `Booking confirmed — ${input.serviceName} with ${input.businessName}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 8px">You're booked! ✅</h2>
    <p style="margin:0 0 16px;color:#444">Hi ${escapeHtml(input.customerName)}, your appointment is confirmed.</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
      <tr><td style="padding:6px 0;color:#666">Service</td><td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(input.serviceName)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">With</td><td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(input.businessName)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">When</td><td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(when)}</td></tr>
    </table>
    <a href="${input.manageUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Manage your booking</a>
    <p style="margin:16px 0 0;color:#888;font-size:13px">Need to reschedule or cancel? Use the button above.</p>
  </div>`;
  return { subject, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
