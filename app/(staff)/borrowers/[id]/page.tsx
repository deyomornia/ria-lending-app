import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPeso } from "@/lib/interest/money";
import { AccessCodePanel } from "@/components/staff/AccessCodePanel";

export const metadata = { title: "Borrower — RIA Lending" };

const STATUS_BADGE: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  paid: "bg-base-200 text-base-content/70",
  defaulted: "bg-error/20 text-error",
  cancelled: "bg-base-200 text-base-content/70",
  restructured: "bg-warning/20 text-warning",
  draft: "bg-base-200 text-base-content/70",
};

export default async function BorrowerPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireStaff();
  const { id } = await params;

  const { data: borrower } = await supabase
    .from("borrowers")
    .select("*, loans(id, loan_number, status, interest_method, principal_centavos, total_payable_centavos, release_date)")
    .eq("id", id)
    .single();
  if (!borrower) notFound();

  const loanIds = (borrower.loans ?? []).map((l: { id: string }) => l.id);
  const { data: balances } = loanIds.length
    ? await supabase.from("loan_balances").select("*").in("loan_id", loanIds)
    : { data: [] };
  const balanceByLoan = new Map((balances ?? []).map((b) => [b.loan_id, b.outstanding_centavos]));

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
          <h1 className="text-xl font-bold text-base-content">{borrower.full_name}</h1>
          <p className="text-sm text-base-content/70">{borrower.phone}</p>
          {borrower.address && <p className="text-sm text-base-content/70">{borrower.address}</p>}
          {borrower.id_type && (
            <p className="text-sm text-base-content/70">
              {borrower.id_type} · {borrower.id_number}
            </p>
          )}
        </div>
        <Link
          href={`/loans/new?borrower=${borrower.id}`}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-semibold text-primary-content hover:bg-secondary"
        >
          + New loan
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-base-content/70">Loans</h2>
          <div className="overflow-hidden rounded-xl border border-base-300 bg-white shadow-sm">
            <table className="w-full text-base">
              <thead className="bg-base-200 text-left text-sm uppercase tracking-wide text-base-content/70">
                <tr>
                  <th className="px-4 py-2">Loan #</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Principal</th>
                  <th className="px-4 py-2 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {(borrower.loans ?? []).map(
                  (l: {
                    id: string;
                    loan_number: string;
                    status: string;
                    principal_centavos: number;
                  }) => (
                    <tr key={l.id} className="hover:bg-base-200">
                      <td className="px-4 py-2">
                        <Link href={`/loans/${l.id}`} className="font-medium text-primary">
                          {l.loan_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-sm font-medium ${STATUS_BADGE[l.status] ?? ""}`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatPeso(l.principal_centavos)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatPeso(balanceByLoan.get(l.id) ?? 0)}
                      </td>
                    </tr>
                  )
                )}
                {(borrower.loans ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-base-content/70">
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
            <div className="rounded-xl border border-base-300 bg-white shadow-sm p-4">
              <h3 className="text-sm font-semibold text-base-content">Notes</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-base-content/70">{borrower.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
