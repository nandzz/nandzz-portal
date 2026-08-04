import "server-only";

// Minimal transactional email helper. Uses Resend's HTTP API when
// RESEND_API_KEY is configured; otherwise logs to the server console so local
// development works without an email provider. No SDK dependency — plain fetch.
//
// Env:
//   RESEND_API_KEY   — Resend API key (optional; absent ⇒ log-only)
//   EMAIL_FROM       — verified From address, e.g. "Nandzz <bookings@nandzz.com>"

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Nandzz <onboarding@resend.dev>";

  if (!apiKey) {
    console.info(`[email] (log-only, RESEND_API_KEY unset) → ${to} :: ${subject}`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, reply_to: replyTo }),
    });
    if (!res.ok) {
      console.error(`[email] send failed (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send threw", err);
    return false;
  }
}
