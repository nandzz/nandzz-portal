// Minimal Twilio WhatsApp sender (REST, no SDK) for the booking-notifications
// function. Business-initiated WhatsApp messages must use a Meta-approved Content
// template (ContentSid + ContentVariables); freeform bodies are never sent here.
//
// Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.

export type TwilioConfig = { accountSid: string; authToken: string; from: string };

export function readTwilioConfig(): TwilioConfig | null {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM")?.trim();
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

// Normalize a stored phone (E.164 from the booking funnel, or a looser legacy
// value) to Twilio's `whatsapp:+<digits>` address. Null when implausible.
export function toWhatsAppAddress(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = phone.trim().replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (!p.startsWith("+")) p = `+${p}`;
  const digits = p.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `whatsapp:+${digits}`;
}

function fromAddress(from: string): string {
  return from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
}

// WhatsApp rejects template parameters that are empty or contain newlines/tabs
// or 4+ consecutive spaces. Collapse whitespace and substitute a dash for empty.
export function sanitizeParam(v: string): string {
  const s = v.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  return s === "" ? "-" : s;
}

export class TwilioSendError extends Error {
  constructor(
    message: string,
    // 4xx from Twilio (bad number, unapproved template, …) won't succeed on retry.
    readonly permanent: boolean,
  ) {
    super(message);
  }
}

// Send an approved template. Returns the Twilio message SID; throws
// TwilioSendError (permanent for 4xx, retryable for 5xx/network).
export async function sendWhatsAppTemplate(
  cfg: TwilioConfig,
  input: { to: string; contentSid: string; variables: Record<string, string> },
): Promise<string> {
  const params = new URLSearchParams({
    From: fromAddress(cfg.from),
    To: input.to,
    ContentSid: input.contentSid,
    ContentVariables: JSON.stringify(input.variables),
  });

  let res: Response;
  try {
    res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${cfg.accountSid}:${cfg.authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
  } catch (err) {
    throw new TwilioSendError(`network: ${err instanceof Error ? err.message : String(err)}`, false);
  }

  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { code?: number; message?: string };
      detail = `${j.code ?? res.status}: ${j.message ?? text}`;
    } catch { /* keep raw text */ }
    throw new TwilioSendError(`twilio ${res.status} ${detail}`.slice(0, 500), res.status < 500);
  }
  try {
    return (JSON.parse(text) as { sid?: string }).sid ?? "";
  } catch {
    return "";
  }
}
