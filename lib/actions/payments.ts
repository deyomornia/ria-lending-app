"use server";

import { revalidatePath } from "next/cache";
import { requireOwner, requireStaff } from "@/lib/auth/staff";
import { allocatePayment } from "@/lib/allocation";
import { auditLog } from "@/lib/audit";
import { todayInManila } from "@/lib/tz";

export type PaymentResult = { ok: true; paymentId: string } | { ok: false; error: string };

export async function recordPayment(input: {
  loanId: string;
  amountCentavos: number;
  paymentDate?: string;
  method: "cash" | "gcash" | "bank";
  referenceNo?: string;
  note?: string;
  /** who physically collected the money (may differ from the encoder) */
  collectorId?: string | null;
  /** payor's signature (PNG data URL) — required for cash */
  signatureData?: string | null;
}): Promise<PaymentResult> {
  const { supabase, profile } = await requireStaff();

  if (!Number.isSafeInteger(input.amountCentavos) || input.amountCentavos <= 0) {
    return { ok: false, error: "Enter a valid payment amount" };
  }

  const paymentDate = input.paymentDate ?? todayInManila();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    return { ok: false, error: "Enter a valid payment date" };
  }
  if (paymentDate > todayInManila()) {
    return { ok: false, error: "Payment date cannot be in the future" };
  }

  if (input.method === "cash") {
    const sig = input.signatureData ?? "";
    if (!sig.startsWith("data:image/png;base64,") || sig.length < 500) {
      return { ok: false, error: "Cash payments require the payor's signature." };
    }
    if (sig.length > 500_000) {
      return { ok: false, error: "Signature image is too large — please clear and sign again." };
    }
  } else if (!input.referenceNo?.trim()) {
    return { ok: false, error: "Electronic payments require the reference number." };
  }

  const { data: loan } = await supabase
    .from("loans")
    .select("id, status")
    .eq("id", input.loanId)
    .single();
  if (!loan) return { ok: false, error: "Loan not found" };
  if (loan.status !== "active") return { ok: false, error: `Loan is ${loan.status}, not active` };

  const [{ data: penalties }, { data: items }] = await Promise.all([
    supabase
      .from("penalties")
      .select("id, amount_centavos, paid_centavos")
      .eq("loan_id", input.loanId)
      .is("waived_at", null)
      .order("assessed_on", { ascending: true }),
    supabase
      .from("schedule_items")
      .select("id, total_due_centavos, paid_centavos")
      .eq("loan_id", input.loanId)
      .in("status", ["pending", "partial"])
      .order("seq", { ascending: true }),
  ]);

  const openPenalties = (penalties ?? [])
    .map((p) => ({ id: p.id, remaining: p.amount_centavos - p.paid_centavos }))
    .filter((p) => p.remaining > 0);
  const openItems = (items ?? []).map((i) => ({
    id: i.id,
    remaining: i.total_due_centavos - i.paid_centavos,
  }));

  const plan = allocatePayment(input.amountCentavos, openPenalties, openItems);
  if (plan.excess > 0) {
    return {
      ok: false,
      error: `Amount exceeds the remaining balance by ₱${(plan.excess / 100).toFixed(2)}. Enter at most the outstanding total.`,
    };
  }

  const { data: paymentId, error } = await supabase.rpc("apply_payment", {
    p_loan_id: input.loanId,
    p_amount_centavos: input.amountCentavos,
    p_payment_date: paymentDate,
    p_method: input.method,
    p_reference_no: input.referenceNo ?? null,
    p_received_by: profile.id,
    p_note: input.note ?? null,
    p_item_allocations: plan.itemAllocations,
    p_penalty_allocations: plan.penaltyAllocations,
  });

  if (error) return { ok: false, error: error.message };

  const extras: Record<string, unknown> = {};
  if (input.collectorId) extras.collector_id = input.collectorId;
  if (input.method === "cash" && input.signatureData) extras.signature_data = input.signatureData;
  if (Object.keys(extras).length > 0) {
    await supabase.from("payments").update(extras).eq("id", paymentId as string);
  }

  await auditLog({
    actorId: profile.id,
    action: "payment.record",
    entity: "payments",
    entityId: paymentId as string,
    detail: { loanId: input.loanId, amount: input.amountCentavos, method: input.method },
  });

  revalidatePath(`/loans/${input.loanId}`);
  revalidatePath("/dashboard");
  revalidatePath("/collections");
  return { ok: true, paymentId: paymentId as string };
}

export async function voidPayment(
  paymentId: string,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, profile } = await requireOwner();
  if (!reason.trim()) return { ok: false, error: "A reason is required to void a payment" };

  const { error } = await supabase.rpc("void_payment", {
    p_payment_id: paymentId,
    p_voided_by: profile.id,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };

  await auditLog({
    actorId: profile.id,
    action: "payment.void",
    entity: "payments",
    entityId: paymentId,
    detail: { reason: reason.trim() },
  });

  revalidatePath("/collections");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function waivePenalty(
  penaltyId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, profile } = await requireOwner();

  const { error } = await supabase
    .from("penalties")
    .update({ waived_at: new Date().toISOString(), waived_by: profile.id })
    .eq("id", penaltyId)
    .is("waived_at", null);
  if (error) return { ok: false, error: error.message };

  await auditLog({
    actorId: profile.id,
    action: "penalty.waive",
    entity: "penalties",
    entityId: penaltyId,
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
