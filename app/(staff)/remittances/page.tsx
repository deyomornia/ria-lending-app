import { requireStaff } from "@/lib/auth/staff";
import { isManagerUp } from "@/lib/auth/roles";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate, todayInManila } from "@/lib/tz";
import { PageHeader } from "@/components/staff/PageHeader";
import {
  ConfirmRemitButton,
  RemitForm,
} from "@/components/staff/RemitControls";
import { statusBadgeClass } from "@/lib/ui/status";

export const metadata = { title: "Remittances — RIA Lending" };

type Row = {
  collectorId: string;
  name: string;
  released: number;
  collected: number;
  confirmed: number;
  pending: number;
};

export default async function RemittancesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { supabase, profile } = await requireStaff();
  const today = todayInManila();
  const { date = today } = await searchParams;
  const canManage = isManagerUp(profile.role);

  const [
    { data: releases },
    { data: collections },
    { data: remits },
    { data: staff },
  ] = await Promise.all([
    supabase
      .from("loans")
      .select(
        "released_by, created_by, principal_centavos, processing_fee_centavos",
      )
      .eq("release_date", date)
      .in("status", ["active", "paid"]),
    supabase
      .from("payments")
      .select("collector_id, received_by, amount_centavos")
      .eq("payment_date", date)
      .is("voided_at", null),
    supabase
      .from("remittances")
      .select("*, collector:profiles!remittances_collector_id_fkey(full_name)")
      .eq("remit_date", date)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, is_active")
      .order("full_name"),
  ]);

  const nameById = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
  const rowsByCollector = new Map<string, Row>();
  const row = (id: string | null): Row => {
    const key = id ?? "unassigned";
    let r = rowsByCollector.get(key);
    if (!r) {
      r = {
        collectorId: key,
        name: id ? (nameById.get(id) ?? "Unknown") : "Unassigned",
        released: 0,
        collected: 0,
        confirmed: 0,
        pending: 0,
      };
      rowsByCollector.set(key, r);
    }
    return r;
  };

  for (const l of releases ?? []) {
    row(l.released_by ?? l.created_by).released +=
      l.principal_centavos - (l.processing_fee_centavos ?? 0);
  }
  for (const p of collections ?? []) {
    row(p.collector_id ?? p.received_by).collected += p.amount_centavos;
  }
  for (const r of remits ?? []) {
    if (r.status === "confirmed")
      row(r.collector_id).confirmed += r.amount_centavos;
    else row(r.collector_id).pending += r.amount_centavos;
  }

  const rows = [...rowsByCollector.values()].sort(
    (a, b) => b.collected - a.collected,
  );
  const myRow = rowsByCollector.get(profile.id);
  const mySuggested = myRow
    ? Math.max(0, myRow.collected - myRow.confirmed - myRow.pending)
    : 0;

  const activeStaff = (staff ?? []).filter((s) => s.is_active);
  const pendingRemits = (remits ?? []).filter((r) => r.status === "submitted");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Remittances"
        description="Cash releases, collections, and turnover to the office — per collector."
        action={
          <form className="filter-bar">
            <div className="w-full sm:w-44">
              <label htmlFor="remit-date" className="field-label">
                Date
              </label>
              <input
                id="remit-date"
                type="date"
                name="date"
                defaultValue={date}
                max={today}
                className="field-input"
              />
            </div>
            <button className="btn btn-primary">View</button>
          </form>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="table-wrap overflow-x-auto">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-base font-semibold text-ink-900">
                Collector monitoring — {formatLongDate(date)}
              </h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Collector</th>
                  <th className="text-right">Released</th>
                  <th className="text-right">Collected</th>
                  <th className="text-right">Remitted</th>
                  <th className="text-right">Shortage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const shortage = r.collected - r.confirmed - r.pending;
                  return (
                    <tr key={r.collectorId}>
                      <td className="font-medium text-ink-900">{r.name}</td>
                      <td className="text-right tabular-nums text-ink-600">
                        {r.released > 0 ? formatPeso(r.released) : "—"}
                      </td>
                      <td className="text-right tabular-nums text-ink-900">
                        {r.collected > 0 ? formatPeso(r.collected) : "—"}
                      </td>
                      <td className="text-right tabular-nums text-ink-900">
                        {r.confirmed + r.pending > 0 ? (
                          <>
                            {formatPeso(r.confirmed)}
                            {r.pending > 0 && (
                              <span className="ml-1 text-sm text-amber-700">
                                (+{formatPeso(r.pending)} pending)
                              </span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        className={`text-right font-semibold tabular-nums ${
                          shortage > 0 ? "text-red-700" : "text-brand-700"
                        }`}
                      >
                        {shortage > 0 ? formatPeso(shortage) : "✓"}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-ink-500"
                    >
                      No releases, collections, or remittances on this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="table-wrap overflow-x-auto">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-base font-semibold text-ink-900">
                Remittance entries — {formatLongDate(date)}
              </h2>
            </div>
            <table className="data-table">
              <tbody>
                {(remits ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-ink-900">
                      {r.collector?.full_name}
                      {r.note && (
                        <span className="ml-2 text-sm font-normal text-ink-600">
                          {r.note}
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-ink-900">
                      {formatPeso(r.amount_centavos)}
                    </td>
                    <td className="text-right">
                      {r.status === "confirmed" ? (
                        <span
                          className={`${statusBadgeClass("confirmed", "remit")} normal-case`}
                        >
                          Confirmed · {nameById.get(r.confirmed_by) ?? ""}
                        </span>
                      ) : canManage ? (
                        <ConfirmRemitButton remittanceId={r.id} />
                      ) : (
                        <span
                          className={`${statusBadgeClass("pending", "remit")} normal-case`}
                        >
                          Awaiting confirmation
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {(remits ?? []).length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-ink-500">
                      No remittances recorded for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          {pendingRemits.length > 0 && !canManage && (
            <p className="text-sm text-ink-600">
              {pendingRemits.length} remittance
              {pendingRemits.length === 1 ? "" : "s"} awaiting a
              Manager/Owner&apos;s confirmation.
            </p>
          )}
        </div>

        <div>
          <RemitForm
            selfId={profile.id}
            canPickCollector={canManage}
            collectors={activeStaff.map((s) => ({
              id: s.id,
              full_name: s.full_name,
            }))}
            remitDate={date}
            suggestedAmount={mySuggested}
          />
        </div>
      </div>
    </div>
  );
}
