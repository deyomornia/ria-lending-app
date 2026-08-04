"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayment } from "@/lib/actions/payments";
import { formatPeso } from "@/lib/interest/money";
import { todayInManila } from "@/lib/tz";
import { SignaturePad } from "@/components/staff/SignaturePad";

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";
const labelCls = "mb-1 block text-sm font-medium uppercase tracking-wide text-slate-700";

export function RecordPaymentForm({
  loanId,
  outstanding,
  suggestedAmount,
  collectors,
  defaultCollectorId,
}: {
  loanId: string;
  outstanding: number;
  suggestedAmount: number;
  collectors: { id: string; full_name: string }[];
  defaultCollectorId: string | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    suggestedAmount > 0 ? (suggestedAmount / 100).toFixed(2) : ""
  );
  const [collectorId, setCollectorId] = useState(defaultCollectorId ?? "");
  const [paymentDate, setPaymentDate] = useState(todayInManila());
  const [method, setMethod] = useState<"cash" | "gcash" | "bank">("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const centavos = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(centavos) || centavos <= 0) return setError("Enter a valid amount.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return setError("Enter a valid payment date.");
    if (method === "cash" && !signature)
      return setError("Cash payments require the payor's signature.");
    if (method !== "cash" && !referenceNo.trim())
      return setError("Electronic payments require the reference number.");
    setError(null);
    startTransition(async () => {
      const res = await recordPayment({
        loanId,
        amountCentavos: centavos,
        paymentDate,
        collectorId: collectorId || null,
        signatureData: method === "cash" ? signature : null,
        method,
        referenceNo: referenceNo || undefined,
        note: note || undefined,
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
        setReferenceNo("");
        setNote("");
        setSignature(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white shadow-sm p-4">
      <h3 className="text-sm font-semibold text-slate-900">Record payment</h3>
      <p className="mt-1 text-sm text-slate-700">
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
          <label className={labelCls}>Date of payment</label>
          <input
            type="date"
            className={inputCls}
            value={paymentDate}
            max={todayInManila()}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
          <p className="mt-1 text-sm text-slate-600">
            Defaults to today — change it when recording a payment received earlier.
          </p>
        </div>
        <div>
          <label className={labelCls}>Collected by</label>
          <select
            className={inputCls}
            value={collectorId}
            onChange={(e) => setCollectorId(e.target.value)}
          >
            <option value="">— Not specified —</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
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
            <label className={labelCls}>Reference no. *</label>
            <input
              required
              placeholder={method === "gcash" ? "GCash ref no." : "Bank transaction ref"}
              className={inputCls}
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          </div>
        )}
        {method === "cash" && (
          <div>
            <label className={labelCls}>Payor&apos;s signature *</label>
            <SignaturePad onChange={setSignature} />
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
          className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? "Recording…" : "Record payment"}
        </button>
      </div>
    </div>
  );
}
