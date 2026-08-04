import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate, todayInManila } from "@/lib/tz";
import { VoidPaymentButton } from "@/components/staff/OwnerActions";
import { PageHeader } from "@/components/staff/PageHeader";

export const metadata = { title: "Collections — RIA Lending" };

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; collector?: string }>;
}) {
  const { supabase, profile } = await requireStaff();
  const today = todayInManila();
  const { from = today, to = today, collector = "" } = await searchParams;

  let paymentsQuery = supabase
    .from("payments")
    .select(
      "*, profiles!payments_received_by_fkey(full_name), collector:profiles!payments_collector_id_fkey(full_name), loans!inner(id, loan_number, borrowers!inner(id, full_name))"
    )
    .gte("payment_date", from)
    .lte("payment_date", to)
    .order("paid_at", { ascending: false })
    .limit(500);
  if (collector) paymentsQuery = paymentsQuery.eq("collector_id", collector);
  const [{ data: payments }, { data: collectors }] = await Promise.all([
    paymentsQuery,
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  const valid = (payments ?? []).filter((p) => !p.voided_at);
  const total = valid.reduce((a, p) => a + p.amount_centavos, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Collections"
        description={`${valid.length} payment${valid.length === 1 ? "" : "s"} · ${formatPeso(total)} collected in this period`}
        action={
          <form className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-sm uppercase tracking-wide text-slate-700">Collector</label>
            <select
              name="collector"
              defaultValue={collector}
              className="rounded-md border border-slate-300 px-3 py-2 text-base"
            >
              <option value="">All collectors</option>
              {(collectors ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm uppercase tracking-wide text-slate-700">From</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-md border border-slate-300 px-3 py-2 text-base"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm uppercase tracking-wide text-slate-700">To</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-md border border-slate-300 px-3 py-2 text-base"
            />
          </div>
            <button className="rounded-md bg-slate-900 px-3 py-2 text-base font-medium text-white">
              Filter
            </button>
          </form>
        }
      />

      {!collector && valid.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {collectorTotals(valid)
            .map(([name, amt]) => (
              <span
                key={name}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
              >
                {name}: <span className="font-semibold tabular-nums text-slate-900">{formatPeso(amt)}</span>
              </span>
            ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-sm uppercase tracking-wide text-slate-700">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Borrower</th>
              <th className="px-4 py-2">Loan #</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2">Collector</th>
              <th className="px-4 py-2">Encoded by</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
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
                  {p.voided_at && <span className="ml-1 text-sm text-red-500">VOID</span>}
                </td>
                <td className="px-4 py-2 text-sm text-slate-700">
                  {p.method}
                  {p.reference_no ? ` · ${p.reference_no}` : ""}
                </td>
                <td className="px-4 py-2 text-sm text-slate-700">
                  {p.collector?.full_name ?? "—"}
                </td>
                <td className="px-4 py-2 text-sm text-slate-700">{p.profiles?.full_name}</td>
                <td className="px-4 py-2 text-right">
                  {profile.role === "owner" && !p.voided_at && (
                    <VoidPaymentButton paymentId={p.id} />
                  )}
                </td>
              </tr>
            ))}
            {(payments ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-600">
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

function collectorTotals(
  payments: { collector?: { full_name: string } | null; amount_centavos: number }[]
): [string, number][] {
  const acc = new Map<string, number>();
  for (const p of payments) {
    const name = p.collector?.full_name ?? "Unassigned";
    acc.set(name, (acc.get(name) ?? 0) + p.amount_centavos);
  }
  return [...acc.entries()].sort((a, b) => b[1] - a[1]);
}
