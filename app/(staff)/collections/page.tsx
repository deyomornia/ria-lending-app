import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate, todayInManila } from "@/lib/tz";
import { VoidPaymentButton } from "@/components/staff/OwnerActions";

export const metadata = { title: "Collections — RIA Lending" };

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { supabase, profile } = await requireStaff();
  const today = todayInManila();
  const { from = today, to = today } = await searchParams;

  const { data: payments } = await supabase
    .from("payments")
    .select(
      "*, profiles(full_name), loans!inner(id, loan_number, borrowers!inner(id, full_name))"
    )
    .gte("payment_date", from)
    .lte("payment_date", to)
    .order("paid_at", { ascending: false })
    .limit(500);

  const valid = (payments ?? []).filter((p) => !p.voided_at);
  const total = valid.reduce((a, p) => a + p.amount_centavos, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Collections</h1>
          <p className="text-sm text-slate-500">
            {valid.length} payments · <span className="font-semibold">{formatPeso(total)}</span>{" "}
            collected
          </p>
        </div>
        <form className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">From</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">To</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
            Filter
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Borrower</th>
              <th className="px-4 py-2">Loan #</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2">Received by</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(payments ?? []).map((p) => (
              <tr key={p.id} className={p.voided_at ? "opacity-50" : ""}>
                <td className="px-4 py-2 whitespace-nowrap">{formatLongDate(p.payment_date)}</td>
                <td className="px-4 py-2">
                  <Link
                    href={`/borrowers/${p.loans.borrowers.id}`}
                    className="font-medium text-emerald-700"
                  >
                    {p.loans.borrowers.full_name}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/loans/${p.loans.id}`} className="text-emerald-700">
                    {p.loans.loan_number}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatPeso(p.amount_centavos)}
                  {p.voided_at && <span className="ml-1 text-xs text-red-500">VOID</span>}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {p.method}
                  {p.reference_no ? ` · ${p.reference_no}` : ""}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">{p.profiles?.full_name}</td>
                <td className="px-4 py-2 text-right">
                  {profile.role === "owner" && !p.voided_at && (
                    <VoidPaymentButton paymentId={p.id} />
                  )}
                </td>
              </tr>
            ))}
            {(payments ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No payments in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
