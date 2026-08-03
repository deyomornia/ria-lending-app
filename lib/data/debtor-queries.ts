import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ALL debtor-portal reads live here, and every function takes the borrowerId
 * from a VERIFIED debtor session JWT — never from URL params or user input.
 * This is the single chokepoint that prevents IDOR on service-role queries.
 */

export async function getDebtorOverview(borrowerId: string) {
  const admin = createAdminClient();

  const [{ data: borrower }, { data: loans }] = await Promise.all([
    admin.from("borrowers").select("id, full_name, phone").eq("id", borrowerId).single(),
    admin
      .from("loans")
      .select(
        "id, loan_number, status, principal_centavos, total_payable_centavos, payment_frequency, term_periods, release_date"
      )
      .eq("borrower_id", borrowerId)
      .in("status", ["active", "paid"])
      .order("created_at", { ascending: false }),
  ]);

  if (!borrower) return null;

  const loanIds = (loans ?? []).map((l) => l.id);
  if (loanIds.length === 0) {
    return { borrower, loans: [], balances: new Map<string, number>(), schedules: [], payments: [] };
  }

  const [{ data: balances }, { data: schedules }, { data: payments }] = await Promise.all([
    admin.from("loan_balances").select("*").in("loan_id", loanIds).eq("borrower_id", borrowerId),
    admin
      .from("schedule_items")
      .select("id, loan_id, seq, due_date, total_due_centavos, paid_centavos, status")
      .in("loan_id", loanIds)
      .order("due_date"),
    admin
      .from("payments")
      .select("id, loan_id, payment_date, amount_centavos, method")
      .in("loan_id", loanIds)
      .is("voided_at", null)
      .order("payment_date", { ascending: false })
      .limit(50),
  ]);

  return {
    borrower,
    loans: loans ?? [],
    balances: new Map((balances ?? []).map((b) => [b.loan_id, b.outstanding_centavos])),
    schedules: schedules ?? [],
    payments: payments ?? [],
  };
}
