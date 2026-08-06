"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePaymentDetails } from "@/lib/actions/payments";
import { todayInManila } from "@/lib/tz";

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";
const labelCls = "mb-1 block text-sm font-medium uppercase tracking-wide text-slate-700";

export function PaymentEditForm({
  paymentId,
  collectors,
  initial,
}: {
  paymentId: string;
  collectors: { id: string; full_name: string }[];
  initial: {
    paymentDate: string;
    method: "cash" | "gcash" | "bank";
    referenceNo: string;
    collectorId: string | null;
    note: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(initial.paymentDate);
  const [method, setMethod] = useState(initial.method);
  const [referenceNo, setReferenceNo] = useState(initial.referenceNo);
  const [collectorId, setCollectorId] = useState(initial.collectorId ?? "");
  const [note, setNote] = useState(initial.note);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50"
      >
        Edit details
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Edit payment details</h3>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-600 underline">
          Cancel
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        The amount cannot be edited — to fix a wrong amount, void this payment and record it again.
        Every edit is written to the audit trail.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Date of payment</label>
          <input
            type="date"
            max={todayInManila()}
            className={inputCls}
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
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
            <label className={labelCls}>Reference no. *</label>
            <input
              className={inputCls}
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className={labelCls}>Collector</label>
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
        <div className="sm:col-span-2">
          <label className={labelCls}>Note</label>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-2 text-sm text-emerald-700">Saved ✓</p>}
      <button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await updatePaymentDetails(paymentId, {
              paymentDate,
              method,
              referenceNo,
              collectorId: collectorId || null,
              note,
            });
            if (res.ok) {
              setSuccess(true);
              setTimeout(() => setSuccess(false), 2500);
              setOpen(false);
              router.refresh();
            } else {
              setError(res.error);
            }
          });
        }}
        className="mt-3 rounded-md bg-emerald-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
