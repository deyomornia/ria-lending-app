import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { isOwnerUp } from "@/lib/auth/roles";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate, todayInManila } from "@/lib/tz";
import { RecordPaymentForm } from "@/components/staff/RecordPaymentForm";
import {
  VoidPaymentButton,
  WaivePenaltyButton,
} from "@/components/staff/OwnerActions";
import { CollectorSelect } from "@/components/staff/CollectorSelect";
import { LoanWorkflowPanel } from "@/components/staff/LoanWorkflowPanel";
import { isManagerUp } from "@/lib/auth/roles";
import { statusBadgeClass, statusLabel } from "@/lib/ui/status";

export const metadata = { title: "Loan — RIA Lending" };

const METHOD_LABELS: Record<string, string> = {
  flat_addon: "Monthly flat / add-on",
  diminishing: "Diminishing balance",
  one_time_fixed: "One-time fixed",
  per_period_flat: "Flat per payment",
};

export default async function LoanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, profile } = await requireStaff();
  const { id } = await params;
  const today = todayInManila();

  const { data: loan } = await supabase
    .from("loans")
    .select("*, borrowers(id, full_name, phone)")
    .eq("id", id)
    .single();
  if (!loan) notFound();

  const [
    { data: items },
    { data: penalties },
    { data: payments },
    { data: balance },
    { data: collectors },
  ] = await Promise.all([
    supabase.from("schedule_items").select("*").eq("loan_id", id).order("seq"),
    supabase
      .from("penalties")
      .select("*")
      .eq("loan_id", id)
      .order("assessed_on", { ascending: true }),
    supabase
      .from("payments")
      .select(
        "*, profiles!payments_received_by_fkey(full_name), collector:profiles!payments_collector_id_fkey(full_name)",
      )
      .eq("loan_id", id)
      .order("paid_at", { ascending: false }),
    supabase.from("loan_balances").select("*").eq("loan_id", id).single(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const outstanding = balance?.outstanding_centavos ?? 0;
  const openItems = (items ?? []).filter(
    (i) => i.status === "pending" || i.status === "partial",
  );
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
          <h1 className="text-2xl font-bold text-ink-900">
            {loan.loan_number}
          </h1>
          <p className="text-sm text-ink-700">
            <Link
              href={`/borrowers/${loan.borrowers.id}`}
              className="font-medium text-brand-700 hover:underline"
            >
              {loan.borrowers.full_name}
            </Link>{" "}
            · {loan.borrowers.phone}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            {METHOD_LABELS[loan.interest_method]} · {loan.term_periods} payments
            · {loan.payment_frequency.replace("_", "-")} · released{" "}
            {formatLongDate(loan.release_date)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CollectorSelect
            loanId={loan.id}
            collectors={collectors ?? []}
            currentCollectorId={loan.collector_id ?? null}
          />
          <span className={`${statusBadgeClass(loan.status)} px-3 py-1`}>
            {statusLabel(loan.status)}
          </span>
          <a
            href={`/api/loans/${loan.id}/agreement`}
            className="btn btn-secondary py-2 text-sm"
          >
            Agreement PDF
          </a>
        </div>
      </div>

      <LoanWorkflowPanel
        loanId={loan.id}
        status={loan.status}
        canApprove={isManagerUp(profile.role)}
      />
      {loan.status === "rejected" && (
        <div className="surface-danger p-4">
          <p className="text-base font-semibold">Proposal rejected</p>
          {loan.rejection_reason && (
            <p className="mt-1 text-sm opacity-80">
              Reason: {loan.rejection_reason}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Principal" value={formatPeso(loan.principal_centavos)} />
        <Stat
          label="Total payable"
          value={formatPeso(loan.total_payable_centavos)}
        />
        <Stat
          label="Paid so far"
          value={formatPeso(balance?.paid_centavos ?? 0)}
        />
        <Stat label="Outstanding" value={formatPeso(outstanding)} highlight />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="eyebrow mb-2 text-ink-600">Payment schedule</h2>
            <div className="table-wrap overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Due date</th>
                    <th className="text-right">Amount due</th>
                    <th className="text-right">Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(items ?? []).map((it) => {
                    const overdue =
                      (it.status === "pending" || it.status === "partial") &&
                      it.due_date < today;
                    return (
                      <tr key={it.id} className={overdue ? "bg-red-50" : ""}>
                        <td className="text-ink-600 tabular-nums">{it.seq}</td>
                        <td className="whitespace-nowrap">
                          {formatLongDate(it.due_date)}
                          {overdue && (
                            <span className="badge badge-danger ml-2">
                              overdue
                            </span>
                          )}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatPeso(it.total_due_centavos)}
                        </td>
                        <td className="text-right tabular-nums text-ink-700">
                          {it.paid_centavos > 0
                            ? formatPeso(it.paid_centavos)
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={statusBadgeClass(it.status, "schedule")}
                          >
                            {statusLabel(it.status)}
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
              <h2 className="eyebrow mb-2 text-ink-600">Penalties</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <tbody>
                    {(penalties ?? []).map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap">
                          {formatLongDate(p.assessed_on)}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatPeso(p.amount_centavos)}
                        </td>
                        <td>
                          {p.waived_at ? (
                            <span className="text-sm text-ink-600">waived</span>
                          ) : p.paid_centavos >= p.amount_centavos ? (
                            <span className="text-sm text-brand-700">paid</span>
                          ) : (
                            <span className="text-sm font-medium text-red-700">
                              {formatPeso(p.amount_centavos - p.paid_centavos)}{" "}
                              unpaid
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          {isOwnerUp(profile.role) &&
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
            <h2 className="eyebrow mb-2 text-ink-600">Payment history</h2>
            <div className="table-wrap overflow-x-auto">
              <table className="data-table">
                <tbody>
                  {(payments ?? []).map((p) => (
                    <tr key={p.id} className={p.voided_at ? "opacity-50" : ""}>
                      <td className="font-mono">
                        <Link
                          href={`/payments/${p.id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {p.receipt_no ?? "view"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        {formatLongDate(p.payment_date)}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatPeso(p.amount_centavos)}
                      </td>
                      <td className="text-sm text-ink-700">
                        {p.method}
                        {p.reference_no ? ` · ${p.reference_no}` : ""}
                      </td>
                      <td className="text-sm text-ink-600">
                        {p.collector?.full_name
                          ? `collected by ${p.collector.full_name}`
                          : (p.profiles?.full_name ?? "")}
                        {p.voided_at ? " · VOIDED" : ""}
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
                      <td colSpan={6} className="py-6 text-center text-ink-600">
                        No payments yet.
                      </td>
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
              collectors={collectors ?? []}
              defaultCollectorId={loan.collector_id ?? null}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 ${highlight ? "rounded-xl border border-emerald-300 bg-emerald-50" : "surface-card"}`}
    >
      <p className="eyebrow text-ink-600">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">
        {value}
      </p>
    </div>
  );
}
