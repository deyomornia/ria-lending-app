"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayment } from "@/lib/actions/payments";
import { formatPeso } from "@/lib/interest/money";

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500";

export function RecordPaymentForm({
  loanId,
  outstanding,
  suggestedAmount,
}: {
  loanId: string;
  outstanding: number;
  suggestedAmount: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    suggestedAmount > 0 ? (suggestedAmount / 100).toFixed(2) : ""
  );
  const [method, setMethod] = useState<"cash" | "gcash" | "bank">("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const centavos = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(centavos) || centavos <= 0) return setError("Enter a valid amount.");
    setError(null);
    startTransition(async () => {
      const res = await recordPayment({
        loanId,
        amountCentavos: centavos,
        method,
        referenceNo: referenceNo || undefined,
        note: note || undefined,
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
        setReferenceNo("");
        setNote("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Record payment</h3>
      <p className="mt-1 text-xs text-slate-500">
        Outstanding: <span className="font-medium">{formatPeso(outstanding)}</span>. Penalties are
        settled first, then the oldest dues.
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <label className={labelCls}>Amount (₱)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Method</label>
          <select
            className={inputCls}
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          >
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="bank">Bank transfer</option>
          </select>
        </div>
        {method !== "cash" && (
          <div>
            <label className={labelCls}>Reference no.</label>
            <input
              className={inputCls}
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className={labelCls}>Note (optional)</label>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-700">Payment recorded ✓</p>}
        <button
          onClick={submit}
          disabled={pending || outstanding <= 0}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "Recording…" : "Record payment"}
        </button>
      </div>
    </div>
  );
}
