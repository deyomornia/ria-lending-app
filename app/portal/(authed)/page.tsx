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
    0,
  );

  const upcoming = data.schedules
    .filter(
      (s) =>
        (s.status === "pending" || s.status === "partial") &&
        s.due_date >= today,
    )
    .slice(0, 5);
  const overdue = data.schedules.filter(
    (s) =>
      (s.status === "pending" || s.status === "partial") && s.due_date < today,
  );
  const loanNumber = new Map(data.loans.map((l) => [l.id, l.loan_number]));

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">
          Hello, {data.borrower.full_name}!
        </h1>
        <p className="mt-1 text-base text-ink-500">{formatLongDate(today)}</p>
      </div>

      <div className="field-dark animate-rise rounded-panel p-6 text-white shadow-md">
        <p className="eyebrow text-brand-300">Total outstanding balance</p>
        <p className="font-display mt-2 text-4xl font-bold tabular-nums">
          {formatPeso(totalOutstanding)}
        </p>
        <p className="mt-1.5 text-base text-brand-100/75">
          {activeLoans.length} active loan{activeLoans.length === 1 ? "" : "s"}
        </p>
      </div>

      {overdue.length > 0 && (
        <div className="rounded-card border border-red-200 bg-red-50 p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-red-800">
            <span aria-hidden>⚠️</span> Overdue payments
          </h2>
          <ul className="mt-3 space-y-1.5">
            {overdue.map((s) => (
              <li
                key={s.id}
                className="flex justify-between gap-3 text-base text-red-700"
              >
                <span>
                  {formatLongDate(s.due_date)}
                  <span className="ml-1.5 text-sm text-red-600">
                    {loanNumber.get(s.loan_id)}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatPeso(s.total_due_centavos - s.paid_centavos)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-red-700">
            Please settle overdue payments to avoid additional penalties.
          </p>
        </div>
      )}

      <section>
        <h2 className="eyebrow mb-2.5 text-ink-500">Upcoming payments</h2>
        <div className="surface-card divide-y divide-line">
          {upcoming.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-base font-semibold text-ink-900">
                  {formatLongDate(s.due_date)}
                </p>
                <p className="text-sm text-ink-500">
                  {loanNumber.get(s.loan_id)}
                </p>
              </div>
              <p className="font-display text-lg font-bold tabular-nums text-ink-900">
                {formatPeso(s.total_due_centavos - s.paid_centavos)}
              </p>
            </div>
          ))}
          {upcoming.length === 0 && (
            <p className="px-4 py-7 text-center text-base text-ink-500">
              No upcoming payments.{" "}
              {activeLoans.length === 0 ? "You're all settled! 🎉" : ""}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="eyebrow mb-2.5 text-ink-500">My loans</h2>
        <div className="space-y-3">
          {data.loans.map((l) => (
            <div key={l.id} className="surface-card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display font-bold text-ink-900">
                  {l.loan_number}
                </p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                    l.status === "active"
                      ? "bg-brand-100 text-brand-800"
                      : "bg-ink-100 text-ink-600"
                  }`}
                >
                  {l.status === "active" ? "Active" : "Fully paid"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                <div>
                  <p className="text-sm text-ink-500">Loan amount</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-ink-800">
                    {formatPeso(l.principal_centavos)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-ink-500">Total payable</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-ink-800">
                    {formatPeso(l.total_payable_centavos)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-ink-500">Balance</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-brand-700">
                    {formatPeso(data.balances.get(l.id) ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {data.loans.length === 0 && (
            <p className="surface-card px-4 py-7 text-center text-base text-ink-500">
              No loans on record.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="eyebrow mb-2.5 text-ink-500">Recent payments</h2>
        <div className="surface-card divide-y divide-line">
          {data.payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <div>
                <p className="text-base text-ink-800">
                  {formatLongDate(p.payment_date)}
                </p>
                <p className="text-sm text-ink-500">
                  {loanNumber.get(p.loan_id)} · {p.method}
                </p>
              </div>
              <p className="font-semibold tabular-nums text-ink-900">
                {formatPeso(p.amount_centavos)}
              </p>
            </div>
          ))}
          {data.payments.length === 0 && (
            <p className="px-4 py-7 text-center text-base text-ink-500">
              No payments yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
