import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPeso } from "@/lib/interest/money";
import { AccessCodePanel } from "@/components/staff/AccessCodePanel";
import { statusBadgeClass, statusLabel } from "@/lib/ui/status";

export const metadata = { title: "Borrower — RIA Lending" };

export default async function BorrowerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireStaff();
  const { id } = await params;

  const { data: borrower } = await supabase
    .from("borrowers")
    .select(
      "*, loans(id, loan_number, status, interest_method, principal_centavos, total_payable_centavos, release_date)",
    )
    .eq("id", id)
    .single();
  if (!borrower) notFound();

  const loanIds = (borrower.loans ?? []).map((l: { id: string }) => l.id);
  const { data: balances } = loanIds.length
    ? await supabase.from("loan_balances").select("*").in("loan_id", loanIds)
    : { data: [] };
  const balanceByLoan = new Map(
    (balances ?? []).map((b) => [b.loan_id, b.outstanding_centavos]),
  );

  // hasCode check needs service role (borrower_access is deny-all for staff)
  const admin = createAdminClient();
  const { data: access } = await admin
    .from("borrower_access")
    .select("borrower_id")
    .eq("borrower_id", id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">
            {borrower.full_name}
          </h1>
          <p className="mt-1 text-sm text-ink-700">{borrower.phone}</p>
          {borrower.address && (
            <p className="text-sm text-ink-700">{borrower.address}</p>
          )}
          {borrower.id_type && (
            <p className="text-sm text-ink-600">
              {borrower.id_type} · {borrower.id_number}
            </p>
          )}
        </div>
        <Link
          href={`/loans/new?borrower=${borrower.id}`}
          className="btn btn-primary"
        >
          + New loan
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <h2 className="eyebrow mb-2 text-ink-600">Loans</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Loan #</th>
                  <th>Status</th>
                  <th className="text-right">Principal</th>
                  <th className="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {(borrower.loans ?? []).map(
                  (l: {
                    id: string;
                    loan_number: string;
                    status: string;
                    principal_centavos: number;
                  }) => (
                    <tr key={l.id}>
                      <td>
                        <Link
                          href={`/loans/${l.id}`}
                          className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
                        >
                          {l.loan_number}
                        </Link>
                      </td>
                      <td>
                        <span className={statusBadgeClass(l.status)}>
                          {statusLabel(l.status)}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">
                        {formatPeso(l.principal_centavos)}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatPeso(balanceByLoan.get(l.id) ?? 0)}
                      </td>
                    </tr>
                  ),
                )}
                {(borrower.loans ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-ink-500">
                      No loans yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <AccessCodePanel borrowerId={borrower.id} hasCode={!!access} />
          {borrower.notes && (
            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-ink-900">Notes</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-600">
                {borrower.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
