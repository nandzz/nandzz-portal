import "server-only";

import { createHmac } from "node:crypto";

// Tells the Business Agent worker that an approval was decided, so it can
// message the customer. Carries ids only: the worker reads the outcome itself
// through mcp-agent, scoped to that customer's chat. Signed with
// AGENT_NOTIFY_SECRET (same value in the worker); best effort, never throws.
export async function notifyApprovalDecided(input: {
  approvalId: string;
  phoneNumberId: string;
  customerWaId: string;
}): Promise<boolean> {
  const url = process.env.AGENT_WORKER_URL;
  const secret = process.env.AGENT_NOTIFY_SECRET;
  if (!url || !secret) {
    console.warn("[my-agent] AGENT_WORKER_URL / AGENT_NOTIFY_SECRET not set; customer not notified");
    return false;
  }
  const body = JSON.stringify({
    approval_id: input.approvalId,
    phone_number_id: input.phoneNumberId,
    customer_wa_id: input.customerWaId,
    ts: Math.floor(Date.now() / 1000),
  });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const res = await fetch(new URL("/internal/approval-decided", url), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nandzz-Signature": `sha256=${signature}` },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn("[my-agent] worker notify failed:", res.status);
    return res.ok;
  } catch (err) {
    console.warn("[my-agent] worker notify failed:", (err as Error).message);
    return false;
  }
}
