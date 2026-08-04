"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmRemittance, submitRemittance } from "@/lib/actions/remittances";
import { formatPeso } from "@/lib/interest/money";

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";
const labelCls = "mb-1 block text-sm font-medium uppercase tracking-wide text-slate-700";

export function RemitForm({
  selfId,
  canPickCollector,
  collectors,
  remitDate,
  suggestedAmount,
}: {
  selfId: string;
  canPickCollector: boolean;
  collectors: { id: string; full_name: string }[];
  remitDate: string;
  suggestedAmount: number;
}) {
  const router = useRouter();
  const [collectorId, setCollectorId] = useState(selfId);
  const [amount, setAmount] = useState(
    suggestedAmount > 0 ? (suggestedAmount / 100).toFixed(2) : ""
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Submit remittance</h3>
      <p className="mt-1 text-sm text-slate-600">
        Record the cash being turned over to the office for {remitDate}. A Manager or Owner
        confirms it upon receiving the money.
      </p>
      <div className="mt-3 space-y-3">
        {canPickCollector && (
          <div>
            <label className={labelCls}>Collector</label>
            <select
              className={inputCls}
              value={collectorId}
              onChange={(e) => setCollectorId(e.target.value)}
            >
              {collectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={labelCls}>Amount remitted (₱)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {suggestedAmount > 0 && (
            <p className="mt-1 text-sm text-slate-600">
              Unremitted collections for this day: {formatPeso(suggestedAmount)}
            </p>
          )}
        </div>
        <div>
          <label className={labelCls}>Note (optional)</label>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-700">Remittance submitted ✓</p>}
        <button
          disabled={pending}
          onClick={() => {
            const centavos = Math.round(parseFloat(amount) * 100);
            if (!Number.isFinite(centavos) || centavos <= 0)
              return setError("Enter a valid amount.");
            setError(null);
            startTransition(async () => {
              const res = await submitRemittance({
                collectorId,
                remitDate,
                amountCentavos: centavos,
                note: note || undefined,
              });
              if (res.ok) {
                setSuccess(true);
                setNote("");
                setTimeout(() => setSuccess(false), 2500);
                router.refresh();
              } else {
                setError(res.error);
              }
            });
          }}
          className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit remittance"}
        </button>
      </div>
    </div>
  );
}

export function ConfirmRemitButton({ remittanceId }: { remittanceId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          setTimeout(() => setConfirming(false), 4000);
          return;
        }
        startTransition(async () => {
          const res = await confirmRemittance(remittanceId);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
      className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
    >
      {pending ? "Confirming…" : confirming ? "Cash received?" : "Confirm receipt"}
    </button>
  );
}
