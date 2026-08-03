"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/staff";
import { computeSchedule } from "@/lib/interest/engine";
import type { LoanTerms } from "@/lib/interest/types";
import { auditLog } from "@/lib/audit";

export type CreateLoanResult = { ok: true; loanId: string } | { ok: false; error: string };

/**
 * Creates an active loan with its precomputed schedule, atomically via the
 * create_loan_with_schedule SQL function. The schedule is recomputed here on
 * the server — the client's preview is never trusted.
 */
export async function createLoan(
  borrowerId: string,
  terms: LoanTerms,
  penalty: { rateBps: number; graceDays: number }
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

  const { data, error } = await supabase.rpc("create_loan_with_schedule", {
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
