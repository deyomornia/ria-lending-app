import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate, todayInManila } from "@/lib/tz";

export const metadata = { title: "Dashboard — RIA Lending" };

type DueRow = {
  id: string;
  due_date: string;
  total_due_centavos: number;
  paid_centavos: number;
  loans: {
    id: string;
    loan_number: string;
    borrowers: { id: string; full_name: string; phone: string };
  };
};

export default async function DashboardPage() {
  const { supabase, profile } = await requireStaff();
  const today = todayInManila();

  const [dueTodayRes, overdueRes, activeLoansRes, balancesRes, todayPaymentsRes] =
    await Promise.all([
      supabase
        .from("schedule_items")
        .select(
          "id, due_date, total_due_centavos, paid_centavos, loans!inner(id, loan_number, status, borrowers!inner(id, full_name, phone))"
        )
        .in("status", ["pending", "partial"])
        .eq("due_date", today)
        .eq("loans.status", "active")
        .order("due_date"),
      supabase
        .from("schedule_items")
        .select(
          "id, due_date, total_due_centavos, paid_centavos, loans!inner(id, loan_number, status, borrowers!inner(id, full_name, phone))"
        )
        .in("status", ["pending", "partial"])
        .lt("due_date", today)
        .eq("loans.status", "active")
        .order("due_date")
        .limit(100),
      supabase.from("loans").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase
        .from("loan_balances")
        .select("outstanding_centavos, loans!inner(status)")
        .eq("loans.status", "active"),
      supabase
        .from("payments")
        .select("amount_centavos")
        .eq("payment_date", today)
        .is("voided_at", null),
    ]);

  const dueToday = (dueTodayRes.data ?? []) as unknown as DueRow[];
  const overdue = (overdueRes.data ?? []) as unknown as DueRow[];
  const totalOutstanding = (balancesRes.data ?? []).reduce(
    (a, b) => a + (b.outstanding_centavos ?? 0),
    0
  );
  const collectedToday = (todayPaymentsRes.data ?? []).reduce((a, p) => a + p.amount_centavos, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Good day, {profile.full_name}!</h1>
        <p className="text-sm text-slate-500">{formatLongDate(today)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active loans" value={String(activeLoansRes.count ?? 0)} />
        <Stat label="Total outstanding" value={formatPeso(totalOutstanding)} />
        <Stat label="Due today" value={String(dueToday.length)} />
        <Stat label="Collected today" value={formatPeso(collectedToday)} good />
      </div>

      <DueTable title="🔔 Due today" rows={dueToday} emptyText="Nothing due today." />
      <DueTable
        title="⚠️ Overdue"
        rows={overdue}
        emptyText="No overdue payments. Great!"
        overdue
      />
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${good ? "text-emerald-700" : "text-slate-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

function DueTable({
  title,
  rows,
  emptyText,
  overdue,
}: {
  title: string;
  rows: DueRow[];
  emptyText: string;
  overdue?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Borrower</th>
              <th className="px-4 py-2">Loan #</th>
              <th className="px-4 py-2">Due date</th>
              <th className="px-4 py-2 text-right">Amount due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className={overdue ? "bg-red-50/50" : ""}>
                <td className="px-4 py-2">
                  <Link
                    href={`/borrowers/${r.loans.borrowers.id}`}
                    className="font-medium text-emerald-700"
                  >
                    {r.loans.borrowers.full_name}
                  </Link>
                  <span className="ml-2 text-xs text-slate-400">{r.loans.borrowers.phone}</span>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/loans/${r.loans.id}`} className="text-emerald-700">
                    {r.loans.loan_number}
                  </Link>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{formatLongDate(r.due_date)}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatPeso(r.total_due_centavos - r.paid_centavos)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
