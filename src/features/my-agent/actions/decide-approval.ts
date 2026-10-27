"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FEATURES } from "@/lib/flags";
import { executeApproval, type ClaimedApproval } from "../server/execute-approval";
import { notifyApprovalDecided } from "../server/notify-worker";

export type DecideApprovalResult =
  | { ok: true; status: "approved" | "rejected" | "failed"; outcome?: string }
  | { ok: false; error: "UNAUTHENTICATED" | "INVALID_INPUT" | "NOT_PENDING" | "FAILED" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTIVITY_KIND = {
  new_booking: "booking_created",
  reschedule: "booking_rescheduled",
  cancel: "booking_cancelled",
} as const;

// Approve or reject a request the Business Agent left pending (My Agent →
// Activity). The claim (pending → approved/rejected) is one conditional UPDATE,
// so a double click or two tabs can't run it twice. Approving re-checks the
// slot and executes; if the slot is gone the approval ends as failed. Either
// way the worker is pinged to tell the customer on WhatsApp.
export async function decideApproval(input: {
  approvalId: string;
  decision: "approve" | "reject";
}): Promise<DecideApprovalResult> {
  if (!FEATURES.businessAgent) return { ok: false, error: "UNAUTHENTICATED" };
  if (!UUID_RE.test(input?.approvalId ?? "") || !["approve", "reject"].includes(input?.decision)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  // Approvals, threads and activity are written only with the service role
  // (owners have read-only RLS); ownership is pinned by owner_user_id.
  const admin = createAdminClient();
  const status = input.decision === "approve" ? "approved" : "rejected";
  const { data: claimed, error: claimError } = await admin
    .from("agent_approvals")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", input.approvalId)
    .eq("owner_user_id", user.id)
    .eq("status", "pending")
    .select(
      "id, owner_user_id, thread_id, kind, booking_id, request, thread:agent_threads(customer_wa_id, customer_name, connection:whatsapp_connections(phone_number_id, widget_instance_id))",
    )
    .maybeSingle();
  if (claimError) return { ok: false, error: "FAILED" };
  if (!claimed) return { ok: false, error: "NOT_PENDING" };

  const approval = claimed as unknown as ClaimedApproval & {
    thread: ClaimedApproval["thread"] & { connection: { phone_number_id: string } };
  };

  let result: DecideApprovalResult;
  if (status === "rejected") {
    await admin.from("agent_activity").insert({
      owner_user_id: user.id,
      thread_id: approval.thread_id,
      kind: "approval_rejected",
      summary: "You rejected the request",
      data: { approval_id: approval.id, kind: approval.kind },
    });
    result = { ok: true, status: "rejected" };
  } else {
    const done = await executeApproval(approval);
    if (done.ok) {
      await admin.from("agent_approvals").update({ booking_id: done.bookingId }).eq("id", approval.id);
      await admin.from("agent_activity").insert({
        owner_user_id: user.id,
        thread_id: approval.thread_id,
        kind: ACTIVITY_KIND[approval.kind],
        summary: done.summary,
        data: { approval_id: approval.id, booking_id: done.bookingId },
      });
      result = { ok: true, status: "approved" };
    } else {
      await admin.from("agent_approvals").update({ status: "failed", outcome: done.outcome }).eq("id", approval.id);
      await admin.from("agent_activity").insert({
        owner_user_id: user.id,
        thread_id: approval.thread_id,
        kind: "approval_failed",
        summary: done.outcome === "slot_taken" ? "Approved, but the time was no longer free" : "Approved, but it couldn't be done",
        data: { approval_id: approval.id, outcome: done.outcome },
      });
      result = { ok: true, status: "failed", outcome: done.outcome };
    }
  }

  await notifyApprovalDecided({
    approvalId: approval.id,
    phoneNumberId: approval.thread.connection.phone_number_id,
    customerWaId: approval.thread.customer_wa_id,
  });
  revalidatePath("/dashboard/my-agent", "layout");
  return result;
}
