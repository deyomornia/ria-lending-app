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
  searchParams: Promise<{
    from?: string;
    to?: string;
    collector?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { supabase, profile } = await requireStaff();
  const today = todayInManila();
  const {
    from = today,
    to = today,
    collector = "",
    sort = "date",
    dir: dirRaw = "desc",
  } = await searchParams;
  const dir = dirRaw === "asc" ? ("asc" as const) : ("desc" as const);

  let paymentsQuery = supabase
    .from("payments")
    .select(
      "*, profiles!payments_received_by_fkey(full_name), collector:profiles!payments_collector_id_fkey(full_name), loans!inner(id, loan_number, borrowers!inner(id, full_name))",
    )
    .gte("payment_date", from)
    .lte("payment_date", to)
    .order("paid_at", { ascending: false })
    .limit(500);
  if (collector) paymentsQuery = paymentsQuery.eq("collector_id", collector);
  const [{ data: payments }, { data: collectors }] = await Promise.all([
    paymentsQuery,
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name"),
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
          <form className="filter-bar">
            <div className="w-full sm:w-52">
              <label htmlFor="collections-collector" className="field-label">
                Collector
              </label>
              <select
                id="collections-collector"
                name="collector"
                defaultValue={collector}
                className="field-input"
              >
                <option value="">All collectors</option>
                {(collectors ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor="collections-from" className="field-label">
                From
              </label>
              <input
                id="collections-from"
                type="date"
                name="from"
                defaultValue={from}
                className="field-input"
              />
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor="collections-to" className="field-label">
                To
              </label>
              <input
                id="collections-to"
                type="date"
                name="to"
                defaultValue={to}
                className="field-input"
              />
            </div>
            <button className="btn btn-primary">Filter</button>
          </form>
        }
      />

      {!collector && valid.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {collectorTotals(valid).map(([name, amt]) => (
            <span
              key={name}
              className="btn btn-secondary cursor-default rounded-full px-3 py-1.5 text-sm font-normal"
            >
              {name}:{" "}
              <span className="font-semibold tabular-nums text-ink-900">
                {formatPeso(amt)}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="table-wrap overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <SortHeader label="Receipt #" col="receipt" {...sortProps} />
              <SortHeader label="Date" col="date" {...sortProps} />
              <SortHeader label="Borrower" col="borrower" {...sortProps} />
              <SortHeader
                label="Amount"
                col="amount"
                align="right"
                {...sortProps}
              />
              <SortHeader label="Method" col="method" {...sortProps} />
              <SortHeader label="Collector" col="collector" {...sortProps} />
              <th className="px-4 py-2 font-semibold">Encoded by</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className={p.voided_at ? "opacity-60" : ""}>
                <td className="font-mono">
                  <Link
                    href={`/payments/${p.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {p.receipt_no ?? "view"}
                  </Link>
                </td>
                <td className="whitespace-nowrap text-ink-700">
                  {formatLongDate(p.payment_date)}
                </td>
                <td>
                  <Link
                    href={`/borrowers/${p.loans.borrowers.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {p.loans.borrowers.full_name}
                  </Link>
                  <Link
                    href={`/loans/${p.loans.id}`}
                    className="ml-2 text-sm text-brand-700 hover:underline"
                  >
                    {p.loans.loan_number}
                  </Link>
                </td>
                <td className="text-right font-medium tabular-nums text-ink-900">
                  {formatPeso(p.amount_centavos)}
                  {p.voided_at && (
                    <span className="ml-1 text-sm font-semibold text-red-700">
                      VOID
                    </span>
                  )}
                </td>
                <td className="text-sm text-ink-600">
                  {p.method}
                  {p.reference_no ? ` · ${p.reference_no}` : ""}
                </td>
                <td className="text-sm text-ink-600">
                  {p.collector?.full_name ?? "—"}
                </td>
                <td className="text-sm text-ink-600">
                  {p.profiles?.full_name}
                </td>
                <td className="text-right">
                  {isOwnerUp(profile.role) && !p.voided_at && (
                    <VoidPaymentButton paymentId={p.id} />
                  )}
                </td>
              </tr>
            ))}
            {(payments ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-ink-500">
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
  payments: {
    collector?: { full_name: string } | null;
    amount_centavos: number;
  }[],
): [string, number][] {
  const acc = new Map<string, number>();
  for (const p of payments) {
    const name = p.collector?.full_name ?? "Unassigned";
    acc.set(name, (acc.get(name) ?? 0) + p.amount_centavos);
  }
  return [...acc.entries()].sort((a, b) => b[1] - a[1]);
}
