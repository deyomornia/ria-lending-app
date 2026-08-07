import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { isOwnerUp } from "@/lib/auth/roles";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate, todayInManila } from "@/lib/tz";
import { VoidPaymentButton } from "@/components/staff/OwnerActions";
import { PageHeader } from "@/components/staff/PageHeader";
import { applySort, SortHeader } from "@/components/staff/SortHeader";

export const metadata = { title: "Collections — RIA Lending" };

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; collector?: string; sort?: string; dir?: string }>;
}) {
  const { supabase, profile } = await requireStaff();
  const today = todayInManila();
  const { from = today, to = today, collector = "", sort = "date", dir: dirRaw = "desc" } = await searchParams;
  const dir = dirRaw === "asc" ? "asc" as const : "desc" as const;

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

  const sorted = applySort(payments ?? [], sort, dir, {
    date: (p) => `${p.payment_date}T${p.paid_at}`,
    receipt: (p) => p.receipt_no ?? "",
    borrower: (p) => p.loans.borrowers.full_name,
    amount: (p) => p.amount_centavos,
    method: (p) => p.method,
    collector: (p) => p.collector?.full_name ?? "",
  });
  const sortProps = {
    currentSort: sort,
    currentDir: dir,
    basePath: "/collections",
    otherParams: { from, to, ...(collector ? { collector } : {}) },
  };
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
            <label className="mb-1 block text-sm uppercase tracking-wide text-base-content/70">Collector</label>
            <select
              name="collector"
              defaultValue={collector}
              className="rounded-md border border-base-300 px-3 py-2 text-base"
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
            <label className="mb-1 block text-sm uppercase tracking-wide text-base-content/70">From</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-md border border-base-300 px-3 py-2 text-base"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm uppercase tracking-wide text-base-content/70">To</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-md border border-base-300 px-3 py-2 text-base"
            />
          </div>
            <button className="rounded-md bg-neutral px-3 py-2 text-base font-medium text-neutral-content">
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
                className="rounded-full border border-base-300 bg-white px-3 py-1.5 text-sm text-base-content/70 shadow-sm"
              >
                {name}: <span className="font-semibold tabular-nums text-base-content">{formatPeso(amt)}</span>
              </span>
            ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-base-300 bg-white shadow-sm">
        <table className="w-full text-base">
          <thead className="bg-base-200 text-left text-sm uppercase tracking-wide text-base-content/70">
            <tr>
              <SortHeader label="Receipt #" col="receipt" {...sortProps} />
              <SortHeader label="Date" col="date" {...sortProps} />
              <SortHeader label="Borrower" col="borrower" {...sortProps} />
              <SortHeader label="Amount" col="amount" align="right" {...sortProps} />
              <SortHeader label="Method" col="method" {...sortProps} />
              <SortHeader label="Collector" col="collector" {...sortProps} />
              <th className="px-4 py-2 font-semibold">Encoded by</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {sorted.map((p) => (
              <tr key={p.id} className={p.voided_at ? "opacity-50" : ""}>
                <td className="px-4 py-2 font-mono">
                  <Link href={`/payments/${p.id}`} className="text-primary hover:underline">
                    {p.receipt_no ?? "view"}
                  </Link>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{formatLongDate(p.payment_date)}</td>
                <td className="px-4 py-2">
                  <Link
                    href={`/borrowers/${p.loans.borrowers.id}`}
                    className="font-medium text-primary"
                  >
                    {p.loans.borrowers.full_name}
                  </Link>
                  <Link href={`/loans/${p.loans.id}`} className="ml-2 text-sm text-primary">
                    {p.loans.loan_number}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatPeso(p.amount_centavos)}
                  {p.voided_at && <span className="ml-1 text-sm text-error">VOID</span>}
                </td>
                <td className="px-4 py-2 text-sm text-base-content/70">
                  {p.method}
                  {p.reference_no ? ` · ${p.reference_no}` : ""}
                </td>
                <td className="px-4 py-2 text-sm text-base-content/70">
                  {p.collector?.full_name ?? "—"}
                </td>
                <td className="px-4 py-2 text-sm text-base-content/70">{p.profiles?.full_name}</td>
                <td className="px-4 py-2 text-right">
                  {isOwnerUp(profile.role) && !p.voided_at && (
                    <VoidPaymentButton paymentId={p.id} />
                  )}
                </td>
              </tr>
            ))}
            {(payments ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-base-content/70">
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
