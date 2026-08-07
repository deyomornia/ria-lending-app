"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalculatorForm } from "@/components/calculator/CalculatorForm";
import { createLoan } from "@/lib/actions/loans";
import type { LoanTerms, ScheduleResult } from "@/lib/interest/types";

const inputCls =
  "w-full rounded-md border border-base-300 px-3 py-2.5 text-base shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "mb-1 block text-sm font-medium uppercase tracking-wide text-base-content/70";

export function NewLoanForm({
  borrowers,
  collectors,
  preselectedBorrowerId,
  isProposal,
}: {
  borrowers: { id: string; full_name: string; phone: string }[];
  collectors: { id: string; full_name: string }[];
  preselectedBorrowerId?: string;
  /** true for collectors: the loan is submitted for approval, not activated */
  isProposal: boolean;
}) {
  const router = useRouter();
  const [borrowerId, setBorrowerId] = useState(preselectedBorrowerId ?? "");
  const [collectorId, setCollectorId] = useState("");
  const [terms, setTerms] = useState<LoanTerms | null>(null);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [penaltyRatePct, setPenaltyRatePct] = useState("5");
  const [graceDays, setGraceDays] = useState("3");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!borrowerId) return setError("Select a borrower first.");
    if (!terms || !result) return setError("Complete the loan terms first.");
    const rateBps = Math.round(parseFloat(penaltyRatePct) * 100);
    const grace = parseInt(graceDays, 10);
    if (!Number.isFinite(rateBps) || rateBps < 0) return setError("Invalid penalty rate.");
    if (!Number.isFinite(grace) || grace < 0) return setError("Invalid grace days.");

    setError(null);
    startTransition(async () => {
      const res = await createLoan(
        borrowerId,
        terms,
        { rateBps, graceDays: grace },
        collectorId || null
      );
      if (res.ok) {
        router.push(`/loans/${res.loanId}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-base-300 bg-white shadow-sm p-6 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Borrower *</label>
          <select
            className={inputCls}
            value={borrowerId}
            onChange={(e) => setBorrowerId(e.target.value)}
          >
            <option value="">— Select borrower —</option>
            {borrowers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.full_name} ({b.phone})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Assigned collector</label>
          <select
            className={inputCls}
            value={collectorId}
            onChange={(e) => setCollectorId(e.target.value)}
          >
            <option value="">— No collector assigned —</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-base-300 bg-white shadow-sm p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-base-content/70">
          Loan terms
        </h2>
        <CalculatorForm
          onResult={(t, r) => {
            setTerms(t);
            setResult(r);
          }}
        />
      </div>

      <div className="rounded-xl border border-base-300 bg-white shadow-sm p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-base-content/70">
          Late-payment penalty
        </h2>
        <div className="grid max-w-md grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Penalty (% of missed payment)</label>
            <input
              type="number"
              min="0"
              step="any"
              className={inputCls}
              value={penaltyRatePct}
              onChange={(e) => setPenaltyRatePct(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Grace period (days)</label>
            <input
              type="number"
              min="0"
              step="1"
              className={inputCls}
              value={graceDays}
              onChange={(e) => setGraceDays(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={pending}
        className="rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-content hover:bg-secondary disabled:opacity-50"
      >
        {pending
          ? "Submitting…"
          : isProposal
            ? "Submit loan proposal for approval"
            : "Create loan (approved — release cash next)"}
      </button>
    </div>
  );
}
