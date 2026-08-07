import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { formatPeso } from "@/lib/interest/money";
import { addDays, diffDays } from "@/lib/interest/dates";
import { formatLongDate, todayInManila } from "@/lib/tz";
import { PageHeader } from "@/components/staff/PageHeader";
import { isManagerUp } from "@/lib/auth/roles";
import {
  CollectionsBarChart,
  MoneyFlowTrend,
  ProgressRing,
} from "@/components/staff/DashboardCharts";

export const metadata = { title: "Dashboard — RIA Lending" };

type DueRow = {
  id: string;
  due_date: string;
  total_due_centavos: number;
  paid_centavos: number;
  loans: {
    id: string;
    loan_number: string;
    collector_id: string | null;
    borrowers: { id: string; full_name: string; phone: string };
  };
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dayLabel(ymd: string, today: string): string {
  if (ymd === today) return "Today";
  const [y, m, d] = ymd.split("-").map(Number);
  return DAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

const DUE_SELECT =
  "id, due_date, total_due_centavos, paid_centavos, loans!inner(id, loan_number, collector_id, borrowers!inner(id, full_name, phone))";

export default async function DashboardPage() {
  const { supabase, profile } = await requireStaff();
  const today = todayInManila();
  const canManage = isManagerUp(profile.role);

  const weekStart = addDays(today, -6);
  const monthStart = today.slice(0, 8) + "01";
  const [ty, tm] = today.split("-").map(Number);
  // first day of the calendar month 5 months back — a 6-month trend window
  const trendStartMonth = (tm - 6 + 12) % 12; // 0-based
  const trendStartYear = tm - 6 < 0 ? ty - 1 : ty;
  const trendStart = `${trendStartYear}-${String(trendStartMonth + 1).padStart(2, "0")}-01`;

  const [dueTodayRes, overdueRes, activeLoansRes, weekPaymentsRes, staffRes] =
    await Promise.all([
      supabase
        .from("schedule_items")
        .select(DUE_SELECT)
        .in("status", ["pending", "partial"])
        .eq("due_date", today)
        .eq("loans.status", "active")
        .order("due_date"),
      supabase
        .from("schedule_items")
        .select(DUE_SELECT)
        .in("status", ["pending", "partial"])
        .lt("due_date", today)
        .eq("loans.status", "active")
        .order("due_date")
        .limit(500),
      supabase.from("loans").select("id").eq("status", "active"),
      supabase
        .from("payments")
        .select("amount_centavos, payment_date, collector_id, received_by")
        .gte("payment_date", weekStart)
        .lte("payment_date", today)
        .is("voided_at", null),
      supabase.from("profiles").select("id, full_name"),
    ]);

  const dueToday = (dueTodayRes.data ?? []) as unknown as DueRow[];
  const overdue = (overdueRes.data ?? []) as unknown as DueRow[];
  const nameById = new Map(
    (staffRes.data ?? []).map((s) => [s.id, s.full_name]),
  );

  // loan_balances is a view — PostgREST can't join it to loans, so filter by id
  const activeIds = (activeLoansRes.data ?? []).map((l) => l.id);
  const balancesRes = activeIds.length
    ? await supabase
        .from("loan_balances")
        .select("loan_id, outstanding_centavos")
        .in("loan_id", activeIds)
    : { data: [] as { loan_id: string; outstanding_centavos: number }[] };
  const outstandingByLoan = new Map(
    (balancesRes.data ?? []).map((b) => [b.loan_id, b.outstanding_centavos]),
  );
  const totalOutstanding = [...outstandingByLoan.values()].reduce(
    (a, b) => a + b,
    0,
  );

  // 7-day collections series (payment_date is a Manila calendar date)
  const byDay = new Map<string, number>();
  for (const p of weekPaymentsRes.data ?? []) {
    byDay.set(
      p.payment_date,
      (byDay.get(p.payment_date) ?? 0) + p.amount_centavos,
    );
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, label: dayLabel(date, today), total: byDay.get(date) ?? 0 };
  });
  const collectedToday = days[6].total;
  const collectedWeek = days.reduce((a, d) => a + d.total, 0);
  const dueTodayAmt = dueToday.reduce(
    (a, r) => a + r.total_due_centavos - r.paid_centavos,
    0,
  );

  // ---------- collector day view ----------
  if (!canManage) {
    const myDueToday = dueToday.filter(
      (r) => r.loans.collector_id === profile.id,
    );
    const myOverdue = overdue.filter(
      (r) => r.loans.collector_id === profile.id,
    );
    const myCollectedToday = (weekPaymentsRes.data ?? [])
      .filter(
        (p) =>
          p.payment_date === today &&
          (p.collector_id ?? p.received_by) === profile.id,
      )
      .reduce((a, p) => a + p.amount_centavos, 0);
    const { data: myRemits } = await supabase
      .from("remittances")
      .select("amount_centavos")
      .eq("collector_id", profile.id)
      .eq("remit_date", today);
    const myRemitted = (myRemits ?? []).reduce(
      (a, r) => a + r.amount_centavos,
      0,
    );
    const { data: myPending } = await supabase
      .from("loans")
      .select(
        "id, loan_number, status, principal_centavos, borrowers(full_name)",
      )
      .eq("created_by", profile.id)
      .in("status", ["pending_approval", "approved"])
      .order("created_at", { ascending: false })
      .limit(10);

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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="My due today"
            value={String(myDueToday.length)}
            href="#due-today"
          />
          <Stat
            label="My overdue"
            value={String(myOverdue.length)}
            bad={myOverdue.length > 0}
            href="#due-today"
          />
          <Stat
            label="Collected today"
            value={formatPeso(myCollectedToday)}
            good
          />
          <Stat
            label="Unremitted"
            value={formatPeso(Math.max(0, myCollectedToday - myRemitted))}
            href="/remittances"
            hint="tap to remit"
          />
        </div>

        {(myPending ?? []).length > 0 && (
          <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                My loan proposals
              </h2>
            </div>
            <ul className="divide-y divide-slate-200">
              {(myPending ?? []).map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span>
                    <Link
                      href={`/loans/${l.id}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      {l.loan_number}
                    </Link>
                    <span className="ml-2 text-slate-700">
                      {
                        (l.borrowers as unknown as { full_name: string })
                          ?.full_name
                      }
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-sm font-medium ${
                      l.status === "pending_approval"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-sky-100 text-sky-800"
                    }`}
                  >
                    {l.status === "pending_approval"
                      ? "awaiting approval"
                      : "release cash"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-6 space-y-6" id="due-today">
          <DueTable
            title="My collections due today"
            rows={myDueToday}
            emptyText="Nothing due today."
          />
          <DueTable
            title="My overdue — follow up"
            rows={myOverdue}
            emptyText="No overdue accounts. Good work!"
            overdue
          />
        </div>
      </div>
    );
  }

  // ---------- manager / owner analytics ----------
  const [queueRes, mtdRes, trendPayRes, trendRelRes] = await Promise.all([
    supabase
      .from("loans")
      .select(
        "id, loan_number, status, principal_centavos, created_at, borrowers(id, full_name), collector:profiles!loans_collector_id_fkey(full_name)",
      )
      .in("status", ["pending_approval", "approved"])
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("amount_centavos")
      .gte("payment_date", monthStart)
      .lte("payment_date", today)
      .is("voided_at", null),
    supabase
      .from("payments")
      .select("amount_centavos, payment_date")
      .gte("payment_date", trendStart)
      .is("voided_at", null),
    supabase
      .from("loans")
      .select("principal_centavos, processing_fee_centavos, release_date")
      .gte("release_date", trendStart)
      .in("status", ["active", "paid"]),
  ]);

  const queue = (queueRes.data ?? []) as unknown as {
    id: string;
    loan_number: string;
    status: string;
    principal_centavos: number;
    borrowers: { id: string; full_name: string };
    collector: { full_name: string } | null;
  }[];

  // Collection rate: this month's collections vs the recoverable book
  const collectedMTD = (mtdRes.data ?? []).reduce(
    (a, p) => a + p.amount_centavos,
    0,
  );
  const book = totalOutstanding + collectedMTD;
  const collectionRate = book > 0 ? (collectedMTD / book) * 100 : 0;

  // 6-month money flow
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const mIdx = (tm - 1 - i + 12) % 12;
    const y = tm - 1 - i < 0 ? ty - 1 : ty;
    monthKeys.push(`${y}-${String(mIdx + 1).padStart(2, "0")}`);
  }
  const flow = monthKeys.map((key) => ({
    key,
    label: MONTH_LABELS[Number(key.slice(5)) - 1],
    released: 0,
    collected: 0,
  }));
  const flowByKey = new Map(flow.map((f) => [f.key, f]));
  for (const p of trendPayRes.data ?? []) {
    const f = flowByKey.get(p.payment_date.slice(0, 7));
    if (f) f.collected += p.amount_centavos;
  }
  for (const l of trendRelRes.data ?? []) {
    const f = flowByKey.get((l.release_date ?? "").slice(0, 7));
    if (f)
      f.released += l.principal_centavos - (l.processing_fee_centavos ?? 0);
  }

  // Portfolio at risk: outstanding sitting on loans with missed payments
  const overdueByLoan = new Map<string, { daysLate: number }>();
  for (const r of overdue) {
    const prev = overdueByLoan.get(r.loans.id);
    overdueByLoan.set(r.loans.id, {
      daysLate: Math.max(prev?.daysLate ?? 0, diffDays(r.due_date, today)),
    });
  }
  let parAmt = 0;
  let par30Amt = 0;
  for (const [loanId, info] of overdueByLoan) {
    const out = outstandingByLoan.get(loanId) ?? 0;
    parAmt += out;
    if (info.daysLate > 30) par30Amt += out;
  }
  const parPct = totalOutstanding > 0 ? (parAmt / totalOutstanding) * 100 : 0;
  const par30Pct =
    totalOutstanding > 0 ? (par30Amt / totalOutstanding) * 100 : 0;

  // Top overdue borrowers
  const byBorrower = new Map<
    string,
    { name: string; amount: number; daysLate: number }
  >();
  for (const r of overdue) {
    const b = r.loans.borrowers;
    const prev = byBorrower.get(b.id);
    byBorrower.set(b.id, {
      name: b.full_name,
      amount: (prev?.amount ?? 0) + (r.total_due_centavos - r.paid_centavos),
      daysLate: Math.max(prev?.daysLate ?? 0, diffDays(r.due_date, today)),
    });
  }
  const topOverdue = [...byBorrower.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Collector leaderboard (last 7 days)
  const byCollector = new Map<string, number>();
  for (const p of weekPaymentsRes.data ?? []) {
    const key = p.collector_id ?? p.received_by;
    byCollector.set(key, (byCollector.get(key) ?? 0) + p.amount_centavos);
  }
  const leaderboard = [...byCollector.entries()]
    .map(([id, amount]) => ({
      id,
      name: nameById.get(id) ?? "Unassigned",
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const leaderMax = leaderboard[0]?.amount ?? 1;

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

      {queue.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
            <h2 className="text-base font-semibold text-amber-900">
              Loan workflow queue — {queue.length} awaiting action
            </h2>
          </div>
          <table className="w-full text-base">
            <tbody className="divide-y divide-slate-200">
              {queue.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/loans/${l.id}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      {l.loan_number}
                    </Link>
                    <span className="ml-2 text-slate-700">
                      {l.borrowers.full_name}
                    </span>
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
                      {l.status === "pending_approval"
                        ? "needs approval"
                        : "release cash"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Active loans"
          value={String(activeIds.length)}
          href="/loans?status=active"
        />
        <Stat
          label="Total outstanding"
          value={formatPeso(totalOutstanding)}
          accent
          href="/loans?status=active&sort=outstanding&dir=desc"
        />
        <Stat
          label="Due today"
          value={String(dueToday.length)}
          hint={dueTodayAmt > 0 ? formatPeso(dueTodayAmt) : undefined}
          href="#due-today"
        />
        <Stat
          label="Collected today"
          value={formatPeso(collectedToday)}
          good
          href={`/collections?from=${today}&to=${today}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Collections — last 7 days
            </h2>
            <Link
              href={`/collections?from=${weekStart}&to=${today}`}
              className="text-sm text-slate-700 hover:underline"
            >
              Week total:{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {formatPeso(collectedWeek)}
              </span>{" "}
              →
            </Link>
          </div>
          <CollectionsBarChart days={days} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Collection rate
          </h2>
          <ProgressRing
            percent={collectionRate}
            label="of book this month"
            sublabel={`${formatPeso(collectedMTD)} collected of the ${formatPeso(book)} recoverable book`}
          />
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-1 text-base font-semibold text-slate-900">
            Money flow — last 6 months
          </h2>
          <MoneyFlowTrend
            months={flow.map(({ label, released, collected }) => ({
              label,
              released,
              collected,
            }))}
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Portfolio at risk
          </h2>
          <p
            className={`text-3xl font-bold tabular-nums ${parPct > 10 ? "text-red-600" : "text-slate-900"}`}
          >
            {parPct.toFixed(1)}%
          </p>
          <p className="text-sm text-slate-600">
            {formatPeso(parAmt)} of the outstanding book sits on loans with
            missed payments.
          </p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="flex h-full">
              <div
                style={{ width: `${Math.min(100, par30Pct)}%` }}
                className="animate-grow-x bg-red-600"
              />
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, parPct - par30Pct))}%`,
                  animationDelay: "80ms",
                }}
                className="animate-grow-x bg-amber-500"
              />
            </div>
          </div>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <p>
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-amber-500"
                aria-hidden
              />
              1–30 days late:{" "}
              <span className="font-medium tabular-nums">
                {formatPeso(parAmt - par30Amt)}
              </span>
            </p>
            <p>
              <span
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-red-600"
                aria-hidden
              />
              Over 30 days:{" "}
              <span className="font-medium tabular-nums">
                {formatPeso(par30Amt)}
              </span>
            </p>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900">
              Top overdue borrowers
            </h2>
          </div>
          <ul className="divide-y divide-slate-200">
            {topOverdue.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span>
                  <Link
                    href={`/borrowers/${b.id}`}
                    className="font-medium text-emerald-700 hover:underline"
                  >
                    {b.name}
                  </Link>
                  <span className="ml-2 text-sm text-red-600">
                    {b.daysLate} day{b.daysLate === 1 ? "" : "s"} late
                  </span>
                </span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatPeso(b.amount)}
                </span>
              </li>
            ))}
            {topOverdue.length === 0 && (
              <li className="px-4 py-6 text-center text-base text-slate-600">
                No overdue borrowers. Excellent.
              </li>
            )}
          </ul>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900">
              Collector leaderboard — last 7 days
            </h2>
          </div>
          <ul className="divide-y divide-slate-200">
            {leaderboard.map((c, i) => (
              <li key={c.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">
                    <span className="mr-2 text-sm text-slate-500">
                      #{i + 1}
                    </span>
                    {c.name}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatPeso(c.amount)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="animate-grow-x h-full rounded-full bg-emerald-600"
                    style={{
                      width: `${(c.amount / leaderMax) * 100}%`,
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                </div>
              </li>
            ))}
            {leaderboard.length === 0 && (
              <li className="px-4 py-6 text-center text-base text-slate-600">
                No collections in the last 7 days.
              </li>
            )}
          </ul>
        </section>
      </div>

      <div className="mt-6 space-y-6" id="due-today">
        <DueTable
          title="Due today"
          rows={dueToday}
          emptyText="Nothing due today."
        />
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
  bad,
  accent,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  good?: boolean;
  bad?: boolean;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={`rounded-xl border p-4 shadow-sm transition-shadow ${
        accent
          ? "border-emerald-700 bg-emerald-700 text-white"
          : "border-slate-200 bg-white"
      } ${href ? "hover:shadow-md" : ""}`}
    >
      <p
        className={`text-sm font-medium uppercase tracking-wide ${accent ? "text-emerald-100" : "text-slate-700"}`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          accent
            ? "text-white"
            : bad
              ? "text-red-600"
              : good
                ? "text-emerald-700"
                : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p
          className={`text-sm tabular-nums ${accent ? "text-emerald-100" : "text-slate-600"}`}
        >
          {hint}
        </p>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">
          {overdue && rows.length > 0 && (
            <span
              className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red-600"
              aria-hidden
            />
          )}
          {title}
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
            overdue && rows.length > 0
              ? "bg-red-100 text-red-700"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {rows.length}
        </span>
      </div>
      <table className="w-full text-base">
        <thead className="bg-slate-50 text-left text-sm uppercase tracking-wide text-slate-700">
          <tr>
            <th className="px-4 py-2 font-semibold">Borrower</th>
            <th className="hidden px-4 py-2 font-semibold sm:table-cell">
              Loan #
            </th>
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
                <Link
                  href={`/loans/${r.loans.id}`}
                  className="text-emerald-700 hover:underline"
                >
                  {r.loans.loan_number}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                {formatLongDate(r.due_date)}
              </td>
              <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                {formatPeso(r.total_due_centavos - r.paid_centavos)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-base text-slate-600"
              >
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
