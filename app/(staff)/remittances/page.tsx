import { requireStaff } from "@/lib/auth/staff";
import { isManagerUp } from "@/lib/auth/roles";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate, todayInManila } from "@/lib/tz";
import { PageHeader } from "@/components/staff/PageHeader";
import { ConfirmRemitButton, RemitForm } from "@/components/staff/RemitControls";

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

  const [{ data: releases }, { data: collections }, { data: remits }, { data: staff }] =
    await Promise.all([
      supabase
        .from("loans")
        .select("released_by, created_by, principal_centavos, processing_fee_centavos")
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
      supabase.from("profiles").select("id, full_name, is_active").order("full_name"),
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
    if (r.status === "confirmed") row(r.collector_id).confirmed += r.amount_centavos;
    else row(r.collector_id).pending += r.amount_centavos;
  }

  const rows = [...rowsByCollector.values()].sort((a, b) => b.collected - a.collected);
  const myRow = rowsByCollector.get(profile.id);
  const mySuggested = myRow ? Math.max(0, myRow.collected - myRow.confirmed - myRow.pending) : 0;

  const activeStaff = (staff ?? []).filter((s) => s.is_active);
  const pendingRemits = (remits ?? []).filter((r) => r.status === "submitted");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Remittances"
        description="Cash releases, collections, and turnover to the office — per collector."
        action={
          <form className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-sm uppercase tracking-wide text-slate-700">Date</label>
              <input
                type="date"
                name="date"
                defaultValue={date}
                max={today}
                className="rounded-md border border-slate-300 px-3 py-2 text-base"
              />
            </div>
            <button className="rounded-md bg-slate-900 px-3 py-2 text-base font-medium text-white">
              View
            </button>
          </form>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                Collector monitoring — {formatLongDate(date)}
              </h2>
            </div>
            <table className="w-full text-base">
              <thead className="bg-slate-50 text-left text-sm uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="px-4 py-2 font-semibold">Collector</th>
                  <th className="px-4 py-2 text-right font-semibold">Released</th>
                  <th className="px-4 py-2 text-right font-semibold">Collected</th>
                  <th className="px-4 py-2 text-right font-semibold">Remitted</th>
                  <th className="px-4 py-2 text-right font-semibold">Shortage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((r) => {
                  const shortage = r.collected - r.confirmed - r.pending;
                  return (
                    <tr key={r.collectorId}>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{r.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                        {r.released > 0 ? formatPeso(r.released) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {r.collected > 0 ? formatPeso(r.collected) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
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
                        className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                          shortage > 0 ? "text-red-600" : "text-emerald-700"
                        }`}
                      >
                        {shortage > 0 ? formatPeso(shortage) : "✓"}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-600">
                      No releases, collections, or remittances on this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                Remittance entries — {formatLongDate(date)}
              </h2>
            </div>
            <table className="w-full text-base">
              <tbody className="divide-y divide-slate-200">
                {(remits ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {r.collector?.full_name}
                      {r.note && <span className="ml-2 text-sm text-slate-600">{r.note}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatPeso(r.amount_centavos)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {r.status === "confirmed" ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-sm font-medium text-emerald-800">
                          Confirmed · {nameById.get(r.confirmed_by) ?? ""}
                        </span>
                      ) : canManage ? (
                        <ConfirmRemitButton remittanceId={r.id} />
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-800">
                          Awaiting confirmation
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {(remits ?? []).length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-600">
                      No remittances recorded for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          {pendingRemits.length > 0 && !canManage && (
            <p className="text-sm text-slate-600">
              {pendingRemits.length} remittance{pendingRemits.length === 1 ? "" : "s"} awaiting a
              Manager/Owner&apos;s confirmation.
            </p>
          )}
        </div>

        <div>
          <RemitForm
            selfId={profile.id}
            canPickCollector={canManage}
            collectors={activeStaff.map((s) => ({ id: s.id, full_name: s.full_name }))}
            remitDate={date}
            suggestedAmount={mySuggested}
          />
        </div>
      </div>
    </div>
  );
}
