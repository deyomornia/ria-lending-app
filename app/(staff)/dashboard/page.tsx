import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { formatPeso } from "@/lib/interest/money";
import { addDays } from "@/lib/interest/dates";
import { formatLongDate, todayInManila } from "@/lib/tz";
import { PageHeader } from "@/components/staff/PageHeader";
import { isManagerUp } from "@/lib/auth/roles";
import { AgingBar, CollectionsBarChart } from "@/components/staff/DashboardCharts";

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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(ymd: string, today: string): string {
  if (ymd === today) return "Today";
  const [y, m, d] = ymd.split("-").map(Number);
  return DAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export default async function DashboardPage() {
  const { supabase, profile } = await requireStaff();
  const today = todayInManila();
  const weekStart = addDays(today, -6);

  const [dueTodayRes, overdueRes, activeLoansRes, weekPaymentsRes] =
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
      supabase.from("loans").select("id").eq("status", "active"),
      supabase
        .from("payments")
        .select("amount_centavos, payment_date")
        .gte("payment_date", weekStart)
        .lte("payment_date", today)
        .is("voided_at", null),
    ]);

  const dueToday = (dueTodayRes.data ?? []) as unknown as DueRow[];
  const overdue = (overdueRes.data ?? []) as unknown as DueRow[];

  // Approval queue for managers/owners: proposals + approved-awaiting-release
  const canApprove = isManagerUp(profile.role);
  const { data: queueData } = canApprove
    ? await supabase
        .from("loans")
        .select("id, loan_number, status, principal_centavos, created_at, borrowers(id, full_name), collector:profiles!loans_collector_id_fkey(full_name)")
        .in("status", ["pending_approval", "approved"])
        .order("created_at", { ascending: true })
    : { data: [] };
  const queue = (queueData ?? []) as unknown as {
    id: string;
    loan_number: string;
    status: string;
    principal_centavos: number;
    borrowers: { id: string; full_name: string };
    collector: { full_name: string } | null;
  }[];

  // loan_balances is a view — PostgREST can't join it to loans, so filter by id
  const activeIds = (activeLoansRes.data ?? []).map((l) => l.id);
  const balancesRes = activeIds.length
    ? await supabase.from("loan_balances").select("outstanding_centavos").in("loan_id", activeIds)
    : { data: [] as { outstanding_centavos: number }[] };
  const totalOutstanding = (balancesRes.data ?? []).reduce(
    (a, b) => a + (b.outstanding_centavos ?? 0),
    0
  );

  // 7-day collections series (payment_date is already a Manila calendar date)
  const byDay = new Map<string, number>();
  for (const p of weekPaymentsRes.data ?? []) {
    byDay.set(p.payment_date, (byDay.get(p.payment_date) ?? 0) + p.amount_centavos);
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, label: dayLabel(date, today), total: byDay.get(date) ?? 0 };
  });
  const collectedToday = days[6].total;
  const collectedWeek = days.reduce((a, d) => a + d.total, 0);

  // Portfolio aging
  const overdueAmt = overdue.reduce((a, r) => a + r.total_due_centavos - r.paid_centavos, 0);
  const dueTodayAmt = dueToday.reduce((a, r) => a + r.total_due_centavos - r.paid_centavos, 0);
  const notYetDueAmt = Math.max(0, totalOutstanding - overdueAmt - dueTodayAmt);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`Good day, ${profile.full_name.split(" ")[0]}!`}
        description={formatLongDate(today)}
        action={
          <Link
            href="/loans/new"
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            + New loan
          </Link>
        }
      />

      {canApprove && queue.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-xl border border-amber-300 bg-white shadow-sm">
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
            <h2 className="text-base font-semibold text-amber-900">
              📋 Loan workflow queue — {queue.length} awaiting action
            </h2>
          </div>
          <table className="w-full text-base">
            <tbody className="divide-y divide-slate-200">
              {queue.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/loans/${l.id}`} className="font-medium text-emerald-700 hover:underline">
                      {l.loan_number}
                    </Link>
                    <span className="ml-2 text-slate-700">{l.borrowers.full_name}</span>
                    {l.collector?.full_name && (
                      <span className="ml-2 hidden text-sm text-slate-600 md:inline">
                        via {l.collector.full_name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatPeso(l.principal_centavos)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-sm font-medium ${
                        l.status === "pending_approval"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {l.status === "pending_approval" ? "needs approval" : "release cash"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active loans" value={String(activeIds.length)} />
        <Stat label="Total outstanding" value={formatPeso(totalOutstanding)} accent />
        <Stat
          label="Due today"
          value={String(dueToday.length)}
          hint={dueTodayAmt > 0 ? formatPeso(dueTodayAmt) : undefined}
        />
        <Stat label="Collected today" value={formatPeso(collectedToday)} good />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Collections — last 7 days</h2>
            <p className="text-sm text-slate-700">
              Week total:{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {formatPeso(collectedWeek)}
              </span>
            </p>
          </div>
          <CollectionsBarChart days={days} />
        </section>

        <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Outstanding portfolio</h2>
          <AgingBar overdue={overdueAmt} dueToday={dueTodayAmt} notYetDue={notYetDueAmt} />
          <p className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-700">
            Includes unpaid penalties. Follow up on overdue amounts first — they appear in the red
            list below.
          </p>
        </section>
      </div>

      <div className="mt-6 space-y-6">
        <DueTable title="Due today" rows={dueToday} emptyText="Nothing due today." />
        <DueTable
          title="Overdue — needs follow-up"
          rows={overdue}
          emptyText="No overdue payments. Great!"
          overdue
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  good,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  good?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        accent ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white"
      }`}
    >
      <p
        className={`text-sm font-medium uppercase tracking-wide ${accent ? "text-emerald-100" : "text-slate-700"}`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          accent ? "text-white" : good ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className={`text-sm tabular-nums ${accent ? "text-emerald-100" : "text-slate-600"}`}>
          {hint}
        </p>
      )}
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
    <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">
          {overdue && rows.length > 0 && (
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red-600" aria-hidden />
          )}
          {title}
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
            overdue && rows.length > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"
          }`}
        >
          {rows.length}
        </span>
      </div>
      <table className="w-full text-base">
        <thead className="bg-slate-50 text-left text-sm uppercase tracking-wide text-slate-700">
          <tr>
            <th className="px-4 py-2 font-semibold">Borrower</th>
            <th className="hidden px-4 py-2 font-semibold sm:table-cell">Loan #</th>
            <th className="px-4 py-2 font-semibold">Due date</th>
            <th className="px-4 py-2 text-right font-semibold">Amount due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((r) => (
            <tr key={r.id} className={overdue ? "bg-red-50/50" : ""}>
              <td className="px-4 py-2.5">
                <Link
                  href={`/borrowers/${r.loans.borrowers.id}`}
                  className="font-medium text-emerald-700 hover:underline"
                >
                  {r.loans.borrowers.full_name}
                </Link>
                <span className="ml-2 hidden text-sm text-slate-600 md:inline">
                  {r.loans.borrowers.phone}
                </span>
              </td>
              <td className="hidden px-4 py-2.5 sm:table-cell">
                <Link href={`/loans/${r.loans.id}`} className="text-emerald-700 hover:underline">
                  {r.loans.loan_number}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">{formatLongDate(r.due_date)}</td>
              <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                {formatPeso(r.total_due_centavos - r.paid_centavos)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-base text-slate-600">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
