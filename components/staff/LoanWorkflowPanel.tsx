"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveLoan, rejectLoan, releaseLoan } from "@/lib/actions/loans";

export function LoanWorkflowPanel({
  loanId,
  status,
  canApprove,
}: {
  loanId: string;
  status: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      router.refresh();
    });
  }

  if (status === "pending_approval") {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
        <p className="text-base font-semibold text-warning">Awaiting approval</p>
        <p className="mt-1 text-sm text-warning">
          This loan proposal needs a Manager or Owner&apos;s decision before cash can be released.
        </p>
        {canApprove && (
          <div className="mt-3 flex gap-2">
            <button
              disabled={pending}
              onClick={() => run(() => approveLoan(loanId))}
              className="rounded-md bg-primary px-4 py-2 text-base font-semibold text-primary-content hover:bg-secondary disabled:opacity-50"
            >
              {pending ? "Working…" : "Approve"}
            </button>
            <button
              disabled={pending}
              onClick={() => {
                const reason = window.prompt("Reason for rejecting this loan proposal?");
                if (!reason) return;
                run(() => rejectLoan(loanId, reason));
              }}
              className="rounded-md border border-error/40 bg-white px-4 py-2 text-base font-medium text-error hover:bg-error/10 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="rounded-xl border border-info/40 bg-info/10 p-4">
        <p className="text-base font-semibold text-info">Approved — awaiting cash release</p>
        <p className="mt-1 text-sm text-info">
          Recording the release hands the cash to the borrower and re-anchors the payment schedule
          to today&apos;s date.
        </p>
        <button
          disabled={pending}
          onClick={() => {
            if (!confirmRelease) {
              setConfirmRelease(true);
              setTimeout(() => setConfirmRelease(false), 5000);
              return;
            }
            run(() => releaseLoan(loanId));
          }}
          className="mt-3 rounded-md bg-info px-4 py-2 text-base font-semibold text-info-content hover:bg-info/90 disabled:opacity-50"
        >
          {pending ? "Releasing…" : confirmRelease ? "Confirm — cash handed over?" : "Release cash"}
        </button>
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
      </div>
    );
  }

  return null;
}
