import { redirect } from "next/navigation";
import { getDebtorSession } from "@/lib/auth/debtor-session";
import { getDebtorOverview } from "@/lib/data/debtor-queries";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate, todayInManila } from "@/lib/tz";

export const metadata = { title: "My Loans — RIA Lending" };

export default async function PortalHome() {
  const borrowerId = await getDebtorSession();
  if (!borrowerId) redirect("/portal/login");

  const data = await getDebtorOverview(borrowerId);
  if (!data) redirect("/portal/login");

  const today = todayInManila();
  const activeLoans = data.loans.filter((l) => l.status === "active");
  const totalOutstanding = activeLoans.reduce(
    (a, l) => a + (data.balances.get(l.id) ?? 0),
    0
  );

  const upcoming = data.schedules
    .filter((s) => (s.status === "pending" || s.status === "partial") && s.due_date >= today)
    .slice(0, 5);
  const overdue = data.schedules.filter(
    (s) => (s.status === "pending" || s.status === "partial") && s.due_date < today
  );
  const loanNumber = new Map(data.loans.map((l) => [l.id, l.loan_number]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Hello, {data.borrower.full_name}!</h1>
        <p className="text-sm text-slate-700">{formatLongDate(today)}</p>
      </div>

      <div className="rounded-2xl bg-slate-900 p-6 text-white">
        <p className="text-sm uppercase tracking-wide text-slate-300">Total outstanding balance</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatPeso(totalOutstanding)}</p>
        <p className="mt-1 text-sm text-slate-300">
          {activeLoans.length} active loan{activeLoans.length === 1 ? "" : "s"}
        </p>
      </div>

      {overdue.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-red-800">⚠️ Overdue payments</h2>
          <ul className="mt-2 space-y-1">
            {overdue.map((s) => (
              <li key={s.id} className="flex justify-between text-sm text-red-700">
                <span>
                  {formatLongDate(s.due_date)}
                  <span className="ml-1 text-sm text-red-600">{loanNumber.get(s.loan_id)}</span>
                </span>
                <span className="font-medium tabular-nums">
                  {formatPeso(s.total_due_centavos - s.paid_centavos)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-red-600">
            Please settle overdue payments to avoid additional penalties.
          </p>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
          Upcoming payments
        </h2>
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {upcoming.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{formatLongDate(s.due_date)}</p>
                <p className="text-sm text-slate-600">{loanNumber.get(s.loan_id)}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-slate-900">
                {formatPeso(s.total_due_centavos - s.paid_centavos)}
              </p>
            </div>
          ))}
          {upcoming.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-600">
              No upcoming payments. {activeLoans.length === 0 ? "You're all settled! 🎉" : ""}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
          My loans
        </h2>
        <div className="space-y-3">
          {data.loans.map((l) => (
            <div key={l.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">{l.loan_number}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-sm font-medium ${
                    l.status === "active"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {l.status === "active" ? "Active" : "Fully paid"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm text-slate-600">Loan amount</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatPeso(l.principal_centavos)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total payable</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatPeso(l.total_payable_centavos)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Balance</p>
                  <p className="text-sm font-semibold tabular-nums text-emerald-700">
                    {formatPeso(data.balances.get(l.id) ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {data.loans.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
              No loans on record.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
          Recent payments
        </h2>
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {data.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm text-slate-700">{formatLongDate(p.payment_date)}</p>
                <p className="text-sm text-slate-600">
                  {loanNumber.get(p.loan_id)} · {p.method}
                </p>
              </div>
              <p className="text-sm font-medium tabular-nums text-slate-900">
                {formatPeso(p.amount_centavos)}
              </p>
            </div>
          ))}
          {data.payments.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-600">No payments yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
