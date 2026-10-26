import "server-only";

import { createHmac } from "node:crypto";

// Signed pings to the Business Agent worker. Carry ids only; signed with
// AGENT_NOTIFY_SECRET (same value in the worker). Best effort, never throw.
async function postToWorker(path: string, payload: Record<string, unknown>): Promise<boolean> {
  const url = process.env.AGENT_WORKER_URL;
  const secret = process.env.AGENT_NOTIFY_SECRET;
  if (!url || !secret) {
    console.warn(`[my-agent] AGENT_WORKER_URL / AGENT_NOTIFY_SECRET not set; ${path} not sent`);
    return false;
  }
  const body = JSON.stringify({ ...payload, ts: Math.floor(Date.now() / 1000) });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const res = await fetch(new URL(path, url), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nandzz-Signature": `sha256=${signature}` },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`[my-agent] worker ${path} failed:`, res.status);
    return res.ok;
  } catch (err) {
    console.warn(`[my-agent] worker ${path} failed:`, (err as Error).message);
    return false;
  }
}

/** An approval was decided: the worker reads the outcome itself (chat-scoped) and tells the customer. */
export function notifyApprovalDecided(input: { approvalId: string; phoneNumberId: string; customerWaId: string }) {
  return postToWorker("/internal/approval-decided", {
    approval_id: input.approvalId,
    phone_number_id: input.phoneNumberId,
    customer_wa_id: input.customerWaId,
  });
}

export type ChatRef = { phoneNumberId: string; customerWaId: string };

/** Conversations were deleted: the worker drops its working memory of those chats too. */
export function notifyChatsForgotten(chats: ChatRef[]) {
  if (chats.length === 0) return Promise.resolve(true);
  return postToWorker("/internal/forget-chats", {
    chats: chats.map((c) => ({ phone_number_id: c.phoneNumberId, customer_wa_id: c.customerWaId })),
  });
}
