import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate, todayInManila } from "@/lib/tz";
import { RecordPaymentForm } from "@/components/staff/RecordPaymentForm";
import { VoidPaymentButton, WaivePenaltyButton } from "@/components/staff/OwnerActions";

export const metadata = { title: "Loan — RIA Lending" };

const METHOD_LABELS: Record<string, string> = {
  flat_addon: "Monthly flat / add-on",
  diminishing: "Diminishing balance",
  one_time_fixed: "One-time fixed",
  per_period_flat: "Flat per payment",
};

export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profile } = await requireStaff();
  const { id } = await params;
  const today = todayInManila();

  const { data: loan } = await supabase
    .from("loans")
    .select("*, borrowers(id, full_name, phone)")
    .eq("id", id)
    .single();
  if (!loan) notFound();

  const [{ data: items }, { data: penalties }, { data: payments }, { data: balance }] =
    await Promise.all([
      supabase.from("schedule_items").select("*").eq("loan_id", id).order("seq"),
      supabase
        .from("penalties")
        .select("*")
        .eq("loan_id", id)
        .order("assessed_on", { ascending: true }),
      supabase
        .from("payments")
        .select("*, profiles(full_name)")
        .eq("loan_id", id)
        .order("paid_at", { ascending: false }),
      supabase.from("loan_balances").select("*").eq("loan_id", id).single(),
    ]);

  const outstanding = balance?.outstanding_centavos ?? 0;
  const openItems = (items ?? []).filter((i) => i.status === "pending" || i.status === "partial");
  const nextDue = openItems[0];
  const openPenaltyTotal = (penalties ?? [])
    .filter((p) => !p.waived_at)
    .reduce((a, p) => a + (p.amount_centavos - p.paid_centavos), 0);
  const suggested = nextDue
    ? nextDue.total_due_centavos - nextDue.paid_centavos + openPenaltyTotal
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{loan.loan_number}</h1>
          <p className="text-sm text-slate-500">
            <Link href={`/borrowers/${loan.borrowers.id}`} className="font-medium text-emerald-700">
              {loan.borrowers.full_name}
            </Link>{" "}
            · {loan.borrowers.phone}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {METHOD_LABELS[loan.interest_method]} · {loan.term_periods} payments ·{" "}
            {loan.payment_frequency.replace("_", "-")} · released {formatLongDate(loan.release_date)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
            {loan.status}
          </span>
          <a
            href={`/api/loans/${loan.id}/agreement`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            📄 Agreement PDF
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Principal" value={formatPeso(loan.principal_centavos)} />
        <Stat label="Total payable" value={formatPeso(loan.total_payable_centavos)} />
        <Stat label="Paid so far" value={formatPeso(balance?.paid_centavos ?? 0)} />
        <Stat label="Outstanding" value={formatPeso(outstanding)} highlight />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Payment schedule
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Due date</th>
                    <th className="px-3 py-2 text-right">Amount due</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(items ?? []).map((it) => {
                    const overdue =
                      (it.status === "pending" || it.status === "partial") && it.due_date < today;
                    return (
                      <tr key={it.id} className={overdue ? "bg-red-50" : ""}>
                        <td className="px-3 py-2 text-slate-500">{it.seq}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatLongDate(it.due_date)}
                          {overdue && (
                            <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                              overdue
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatPeso(it.total_due_centavos)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                          {it.paid_centavos > 0 ? formatPeso(it.paid_centavos) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              it.status === "paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : it.status === "partial"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {it.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {(penalties ?? []).length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Penalties
              </h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {(penalties ?? []).map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2">{formatLongDate(p.assessed_on)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatPeso(p.amount_centavos)}
                        </td>
                        <td className="px-3 py-2">
                          {p.waived_at ? (
                            <span className="text-xs text-slate-400">waived</span>
                          ) : p.paid_centavos >= p.amount_centavos ? (
                            <span className="text-xs text-emerald-700">paid</span>
                          ) : (
                            <span className="text-xs text-red-600">
                              {formatPeso(p.amount_centavos - p.paid_centavos)} unpaid
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {profile.role === "owner" &&
                            !p.waived_at &&
                            p.paid_centavos < p.amount_centavos && (
                              <WaivePenaltyButton penaltyId={p.id} />
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Payment history
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {(payments ?? []).map((p) => (
                    <tr key={p.id} className={p.voided_at ? "opacity-50" : ""}>
                      <td className="px-3 py-2 whitespace-nowrap">{formatLongDate(p.payment_date)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatPeso(p.amount_centavos)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {p.method}
                        {p.reference_no ? ` · ${p.reference_no}` : ""}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {p.profiles?.full_name ?? ""}
                        {p.voided_at ? " · VOIDED" : ""}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {profile.role === "owner" && !p.voided_at && (
                          <VoidPaymentButton paymentId={p.id} />
                        )}
                      </td>
                    </tr>
                  ))}
                  {(payments ?? []).length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-400">No payments yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          {loan.status === "active" && (
            <RecordPaymentForm
              loanId={loan.id}
              outstanding={outstanding}
              suggestedAmount={Math.min(suggested, outstanding)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${highlight ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
