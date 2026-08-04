"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireStaff } from "@/lib/auth/staff";
import { isManagerUp } from "@/lib/auth/roles";
import { computeSchedule } from "@/lib/interest/engine";
import type { LoanTerms } from "@/lib/interest/types";
import { auditLog } from "@/lib/audit";
import { todayInManila } from "@/lib/tz";

export type CreateLoanResult = { ok: true; loanId: string } | { ok: false; error: string };

/**
 * Creates an active loan with its precomputed schedule, atomically via the
 * create_loan_with_schedule SQL function. The schedule is recomputed here on
 * the server — the client's preview is never trusted.
 */
export async function createLoan(
  borrowerId: string,
  terms: LoanTerms,
  penalty: { rateBps: number; graceDays: number },
  collectorId?: string | null
): Promise<CreateLoanResult> {
  const { supabase, profile } = await requireStaff();

  let result;
  try {
    result = computeSchedule(terms);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  if (!Number.isInteger(penalty.rateBps) || penalty.rateBps < 0)
    return { ok: false, error: "Invalid penalty rate" };
  if (!Number.isInteger(penalty.graceDays) || penalty.graceDays < 0)
    return { ok: false, error: "Invalid grace days" };

  const rateBps =
    terms.method === "flat_addon"
      ? terms.ratePerMonthBps
      : terms.method === "one_time_fixed"
        ? null
        : terms.ratePerPeriodBps;

  // SOP: collectors submit proposals; managers/owners create pre-approved loans
  const initialStatus = isManagerUp(profile.role) ? "approved" : "pending_approval";

  const { data, error } = await supabase.rpc("create_loan_with_schedule", {
    p_initial_status: initialStatus,
    p_borrower_id: borrowerId,
    p_interest_method: terms.method,
    p_principal_centavos: terms.principal,
    p_interest_rate_bps: rateBps,
    p_fixed_interest_centavos: terms.method === "one_time_fixed" ? terms.fixedInterest : null,
    p_payment_frequency: terms.frequency,
    p_term_periods: terms.termPeriods,
    p_processing_fee_centavos: terms.processingFee ?? 0,
    p_release_date: terms.releaseDate,
    p_first_due_date: result.rows[0].dueDate,
    p_total_interest_centavos: result.totalInterest,
    p_total_payable_centavos: result.totalPayable,
    p_penalty_rate_bps: penalty.rateBps,
    p_penalty_grace_days: penalty.graceDays,
    p_created_by: profile.id,
    p_schedule: result.rows.map((r) => ({
      seq: r.seq,
      due_date: r.dueDate,
      principal_due: r.principalDue,
      interest_due: r.interestDue,
      total_due: r.totalDue,
    })),
  });

  if (error) return { ok: false, error: error.message };

  const postCreate: Record<string, unknown> = {};
  if (collectorId) postCreate.collector_id = collectorId;
  if (initialStatus === "approved") {
    postCreate.approved_by = profile.id;
    postCreate.approved_at = new Date().toISOString();
  }
  if (Object.keys(postCreate).length > 0) {
    await supabase.from("loans").update(postCreate).eq("id", data as string);
  }

  await auditLog({
    actorId: profile.id,
    action: "loan.create",
    entity: "loans",
    entityId: data as string,
    detail: { borrowerId, method: terms.method, principal: terms.principal },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/borrowers/${borrowerId}`);
  return { ok: true, loanId: data as string };
}

export async function setLoanCollector(
  loanId: string,
  collectorId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, profile } = await requireStaff();

  if (collectorId) {
    const { data: collector } = await supabase
      .from("profiles")
      .select("id, is_active")
      .eq("id", collectorId)
      .single();
    if (!collector?.is_active) return { ok: false, error: "Collector not found or inactive." };
  }

  const { error } = await supabase
    .from("loans")
    .update({ collector_id: collectorId })
    .eq("id", loanId);
  if (error) return { ok: false, error: error.message };

  await auditLog({
    actorId: profile.id,
    action: "loan.set_collector",
    entity: "loans",
    entityId: loanId,
    detail: { collectorId },
  });
  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/loans");
  return { ok: true };
}

export type WorkflowResult = { ok: true } | { ok: false; error: string };

/** Manager+ approves a pending proposal. */
export async function approveLoan(loanId: string): Promise<WorkflowResult> {
  const { supabase, profile } = await requireManager();

  const { data, error } = await supabase
    .from("loans")
    .update({ approved_by: profile.id, approved_at: new Date().toISOString(), status: "approved" })
    .eq("id", loanId)
    .eq("status", "pending_approval")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "This loan is no longer pending approval." };

  await auditLog({
    actorId: profile.id,
    action: "loan.approve",
    entity: "loans",
    entityId: loanId,
  });
  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/dashboard");
  revalidatePath("/loans");
  return { ok: true };
}

/** Manager+ rejects a pending proposal with a reason. */
export async function rejectLoan(loanId: string, reason: string): Promise<WorkflowResult> {
  const { supabase, profile } = await requireManager();
  if (!reason.trim()) return { ok: false, error: "A rejection reason is required." };

  const { data, error } = await supabase
    .from("loans")
    .update({
      rejected_by: profile.id,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
      status: "rejected",
    })
    .eq("id", loanId)
    .eq("status", "pending_approval")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "This loan is no longer pending approval." };

  await auditLog({
    actorId: profile.id,
    action: "loan.reject",
    entity: "loans",
    entityId: loanId,
    detail: { reason: reason.trim() },
  });
  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/dashboard");
  revalidatePath("/loans");
  return { ok: true };
}

/**
 * Records the cash release of an approved loan. The payment schedule is
 * recomputed anchored to the actual release date (totals are date-independent,
 * so they stay identical — the release_loan SQL function re-verifies that).
 */
export async function releaseLoan(loanId: string): Promise<WorkflowResult> {
  const { supabase, profile } = await requireStaff();

  const { data: loan } = await supabase.from("loans").select("*").eq("id", loanId).single();
  if (!loan) return { ok: false, error: "Loan not found." };
  if (loan.status !== "approved")
    return { ok: false, error: `Loan is ${loan.status} — only approved loans can be released.` };

  const releaseDate = todayInManila();
  const base = {
    principal: loan.principal_centavos,
    frequency: loan.payment_frequency,
    termPeriods: loan.term_periods,
    releaseDate,
    processingFee: loan.processing_fee_centavos,
  };
  const terms: LoanTerms =
    loan.interest_method === "flat_addon"
      ? { ...base, method: "flat_addon", ratePerMonthBps: loan.interest_rate_bps }
      : loan.interest_method === "diminishing"
        ? { ...base, method: "diminishing", ratePerPeriodBps: loan.interest_rate_bps }
        : loan.interest_method === "one_time_fixed"
          ? { ...base, method: "one_time_fixed", fixedInterest: loan.fixed_interest_centavos }
          : { ...base, method: "per_period_flat", ratePerPeriodBps: loan.interest_rate_bps };

  let result;
  try {
    result = computeSchedule(terms);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (result.totalPayable !== loan.total_payable_centavos) {
    return { ok: false, error: "Recomputed schedule does not match the approved totals." };
  }

  const { error } = await supabase.rpc("release_loan", {
    p_loan_id: loanId,
    p_released_by: profile.id,
    p_release_date: releaseDate,
    p_first_due_date: result.rows[0].dueDate,
    p_schedule: result.rows.map((r) => ({
      seq: r.seq,
      due_date: r.dueDate,
      principal_due: r.principalDue,
      interest_due: r.interestDue,
      total_due: r.totalDue,
    })),
  });
  if (error) return { ok: false, error: error.message };

  await auditLog({
    actorId: profile.id,
    action: "loan.release",
    entity: "loans",
    entityId: loanId,
    detail: { releaseDate },
  });
  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/dashboard");
  revalidatePath("/loans");
  return { ok: true };
}
