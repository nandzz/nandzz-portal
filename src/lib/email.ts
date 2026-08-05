import "server-only";

// Transactional email helper. Provider = Amazon SES (not yet wired).
//
// Until SES is configured this logs to the server console and returns false, so
// callers (e.g. booking confirmation) degrade gracefully instead of failing.
// The signature is stable — wiring SES later is a drop-in with no call-site
// changes.
//
// TODO(SES): implement via Amazon SES (SESv2 SendEmail). Needs AWS credentials,
// a region, and a verified From identity (EMAIL_FROM).

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendEmail({ to, subject }: SendEmailInput): Promise<boolean> {
  console.info(`[email] (not sent — SES not configured) → ${to} :: ${subject}`);
  return false;
}
