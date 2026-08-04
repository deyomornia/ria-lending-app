import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { isManagerUp, isOwnerUp } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate } from "@/lib/tz";
import { PageHeader } from "@/components/staff/PageHeader";
import { PaymentEditForm } from "@/components/staff/PaymentEditForm";
import { VoidPaymentButton } from "@/components/staff/OwnerActions";

export const metadata = { title: "Payment — RIA Lending" };

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profile } = await requireStaff();
  const { id } = await params;

  const { data: payment } = await supabase
    .from("payments")
    .select(
      "*, profiles!payments_received_by_fkey(full_name), collector:profiles!payments_collector_id_fkey(full_name), voider:profiles!payments_voided_by_fkey(full_name), loans!inner(id, loan_number, borrowers!inner(id, full_name, phone))"
    )
    .eq("id", id)
    .single();
  if (!payment) notFound();

  const [{ data: allocations }, { data: collectors }] = await Promise.all([
    supabase
      .from("payment_allocations")
      .select("amount_centavos, schedule_items(seq, due_date), penalties(assessed_on)")
      .eq("payment_id", id),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  // Per-payment audit trail (audit_log is service-role only by design)
  const admin = createAdminClient();
  const { data: history } = await admin
    .from("audit_log")
    .select("*")
    .eq("entity", "payments")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const actorIds = [...new Set((history ?? []).map((h) => h.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  const canEdit = isManagerUp(profile.role) && !payment.voided_at;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={payment.receipt_no ?? "Payment"}
        description={`${formatPeso(payment.amount_centavos)} · ${formatLongDate(payment.payment_date)}`}
        action={
          <div className="flex items-center gap-3">
            {payment.voided_at ? (
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                VOIDED
              </span>
            ) : (
              isOwnerUp(profile.role) && <VoidPaymentButton paymentId={payment.id} />
            )}
          </div>
        }
      />

      {payment.voided_at && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          Voided by {payment.voider?.full_name ?? "—"} on{" "}
          {new Date(payment.voided_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
          {payment.void_reason && <> — “{payment.void_reason}”</>}
        </div>
      )}

      <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Item label="Receipt no." value={payment.receipt_no ?? "—"} mono />
          <Item label="Amount" value={formatPeso(payment.amount_centavos)} />
          <Item
            label="Loan"
            value={
              <Link href={`/loans/${payment.loans.id}`} className="text-emerald-700 hover:underline">
                {payment.loans.loan_number}
              </Link>
            }
          />
          <Item
            label="Borrower"
            value={
              <Link
                href={`/borrowers/${payment.loans.borrowers.id}`}
                className="text-emerald-700 hover:underline"
              >
                {payment.loans.borrowers.full_name}
              </Link>
            }
          />
          <Item label="Date of payment" value={formatLongDate(payment.payment_date)} />
          <Item
            label="Method"
            value={`${payment.method}${payment.reference_no ? ` · ${payment.reference_no}` : ""}`}
          />
          <Item label="Collected by" value={payment.collector?.full_name ?? "—"} />
          <Item label="Encoded by" value={payment.profiles?.full_name ?? "—"} />
          {payment.note && <Item label="Note" value={payment.note} />}
          <Item
            label="Encoded at"
            value={new Date(payment.paid_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
          />
        </dl>

        {payment.signature_data && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-700">
              Payor&apos;s signature
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={payment.signature_data}
              alt="Payor's signature"
              className="h-28 rounded-md border border-slate-200 bg-white"
            />
          </div>
        )}

        {(allocations ?? []).length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-700">
              Applied to
            </p>
            <ul className="space-y-1 text-base text-slate-700">
              {(
                (allocations ?? []) as unknown as {
                  amount_centavos: number;
                  schedule_items: { seq: number; due_date: string } | null;
                  penalties: { assessed_on: string } | null;
                }[]
              ).map((a, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {a.schedule_items
                      ? `Installment #${a.schedule_items.seq} (due ${formatLongDate(a.schedule_items.due_date)})`
                      : `Penalty assessed ${a.penalties ? formatLongDate(a.penalties.assessed_on) : ""}`}
                  </span>
                  <span className="tabular-nums">{formatPeso(a.amount_centavos)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {canEdit && (
        <PaymentEditForm
          paymentId={payment.id}
          collectors={collectors ?? []}
          initial={{
            paymentDate: payment.payment_date,
            method: payment.method,
            referenceNo: payment.reference_no ?? "",
            collectorId: payment.collector_id,
            note: payment.note ?? "",
          }}
        />
      )}

      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">History</h2>
        </div>
        <ul className="divide-y divide-slate-200">
          {(history ?? []).map((h) => (
            <li key={h.id} className="px-4 py-3">
              <p className="text-base text-slate-900">
                <span className="font-medium">{actorName.get(h.actor_id) ?? h.actor_type}</span>{" "}
                — {describeAction(h.action)}
                <span className="ml-2 text-sm text-slate-500">
                  {new Date(h.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                </span>
              </p>
              {h.action === "payment.edit" && h.detail?.before && h.detail?.after && (
                <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                  {diffLines(h.detail.before, h.detail.after).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
              {h.action === "payment.void" && h.detail?.reason && (
                <p className="mt-1 text-sm text-slate-600">Reason: {h.detail.reason}</p>
              )}
            </li>
          ))}
          {(history ?? []).length === 0 && (
            <li className="px-4 py-6 text-center text-base text-slate-600">
              No recorded history for this payment.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Item({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-sm font-medium uppercase tracking-wide text-slate-700">{label}</dt>
      <dd className={`mt-0.5 text-base text-slate-900 ${mono ? "font-mono font-semibold" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function describeAction(action: string): string {
  switch (action) {
    case "payment.record":
      return "recorded this payment";
    case "payment.edit":
      return "edited the payment details";
    case "payment.void":
      return "voided this payment";
    default:
      return action;
  }
}

function diffLines(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  const labels: Record<string, string> = {
    payment_date: "Date",
    method: "Method",
    reference_no: "Reference no.",
    collector_id: "Collector",
    note: "Note",
  };
  const lines: string[] = [];
  for (const key of Object.keys(after)) {
    const b = before[key] ?? "—";
    const a = after[key] ?? "—";
    if (String(b) !== String(a)) lines.push(`${labels[key] ?? key}: ${b || "—"} → ${a || "—"}`);
  }
  return lines.length ? lines : ["(no visible changes)"];
}
