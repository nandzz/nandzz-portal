import "server-only";

// Server-side dispatch of an owner-configured booking message. Renders the
// template's variables, then fans out to the channel(s) the owner chose. Every
// send is best-effort (Promise.allSettled) — messaging must never fail the
// caller's request (the booking row is already committed).

import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";
import { renderTemplate } from "@/lib/widgets/messages";
import { formatBookingTime, simpleEmailHtml } from "@/lib/widgets/emails";
import type { MessageTemplate } from "@/lib/types";

export type BookingMessageContext = {
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  businessName: string;
  serviceName: string;
  staffName: string | null;
  startsAt: string;
  timezone: string;
  priceCents: number | null;
  currencySymbol: string;
  manageUrl: string;
};

export function bookingMessageVars(ctx: BookingMessageContext): Record<string, string> {
  const firstName = ctx.customerName.split(" ")[0] || ctx.customerName;
  const price =
    ctx.priceCents != null && ctx.priceCents > 0
      ? `${ctx.currencySymbol}${(ctx.priceCents / 100).toLocaleString(undefined, {
          minimumFractionDigits: ctx.priceCents % 100 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        })}`
      : "";
  return {
    customer_name: ctx.customerName,
    customer_first_name: firstName,
    service: ctx.serviceName,
    staff: ctx.staffName ?? "",
    date_time: formatBookingTime(ctx.startsAt, ctx.timezone),
    business: ctx.businessName,
    price,
    manage_url: ctx.manageUrl,
  };
}

export async function dispatchBookingMessage(
  tpl: MessageTemplate,
  ctx: BookingMessageContext
): Promise<void> {
  if (tpl.channel === "off") return;

  const vars = bookingMessageVars(ctx);
  const body = renderTemplate(tpl.body, vars);
  const wantEmail = tpl.channel === "email" || tpl.channel === "both";
  const wantWa = tpl.channel === "whatsapp" || tpl.channel === "both";

  const jobs: Promise<unknown>[] = [];
  if (wantEmail && ctx.customerEmail) {
    jobs.push(
      sendEmail({
        to: ctx.customerEmail,
        subject: renderTemplate(tpl.subject, vars),
        html: simpleEmailHtml(body),
      })
    );
  }
  if (wantWa && ctx.customerPhone) {
    jobs.push(sendWhatsApp({ to: ctx.customerPhone, body }));
  }

  await Promise.allSettled(jobs);
}
