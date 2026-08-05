import "server-only";

// Outbound WhatsApp via the Twilio REST API. Mirrors `email.ts`: sends when the
// Twilio credentials are configured, otherwise logs to the server console and
// returns false — so booking creation never fails just because messaging isn't
// wired up in this environment.
//
// NOTE: the existing `whatsapp-webhook` edge function is INBOUND only (it replies
// to Twilio via TwiML). This is the separate OUTBOUND path.
//
// Env:
//   TWILIO_ACCOUNT_SID          — Twilio account SID (AC…)
//   TWILIO_AUTH_TOKEN           — Twilio auth token
//   TWILIO_WHATSAPP_FROM        — WhatsApp sender, e.g. "whatsapp:+14155238886"
//                                 (sandbox) or your approved WA business number
//   TWILIO_WHATSAPP_CONTENT_SID — optional. Approved template Content SID. Twilio
//                                 requires a template for business-initiated
//                                 messages (outside the 24h customer-initiated
//                                 window); a freeform Body only delivers in the
//                                 sandbox or that window. When set, we send the
//                                 template with `contentVariables`; otherwise Body.

export type SendWhatsAppInput = {
  to: string; // customer phone, any format
  body: string; // freeform fallback text (sandbox / 24h window)
  contentVariables?: Record<string, string>; // template variables when a Content SID is configured
};

// Normalize an arbitrary phone string to Twilio's `whatsapp:+E164` address.
function toWhatsAppAddress(phone: string): string | null {
  let p = phone.trim().replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (!p.startsWith("+")) p = `+${p}`;
  if (p.replace(/\D/g, "").length < 8) return null; // not a plausible international number
  return `whatsapp:${p}`;
}

function normalizeFrom(from: string): string {
  return from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
}

export async function sendWhatsApp({ to, body, contentVariables }: SendWhatsAppInput): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;

  const toAddr = toWhatsAppAddress(to);
  if (!toAddr) {
    console.warn(`[whatsapp] skipped — unparseable phone "${to}"`);
    return false;
  }

  if (!sid || !token || !from) {
    console.info(`[whatsapp] (log-only, Twilio creds unset) → ${toAddr} :: ${body}`);
    return false;
  }

  const params = new URLSearchParams({ From: normalizeFrom(from), To: toAddr });
  if (contentSid) {
    params.set("ContentSid", contentSid);
    if (contentVariables) params.set("ContentVariables", JSON.stringify(contentVariables));
  } else {
    params.set("Body", body);
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) {
      console.error(`[whatsapp] send failed (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] send threw", err);
    return false;
  }
}
