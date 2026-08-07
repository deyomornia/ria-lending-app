"use client";

import { useState, useTransition } from "react";
import { issueAccessCode } from "@/lib/actions/borrowers";

export function AccessCodePanel({
  borrowerId,
  hasCode,
}: {
  borrowerId: string;
  hasCode: boolean;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-base-300 bg-white shadow-sm p-4">
      <h3 className="text-sm font-semibold text-base-content">Debtor portal access</h3>
      <p className="mt-1 text-sm text-base-content/70">
        {hasCode
          ? "This borrower has a portal access code. Issuing a new one replaces it."
          : "No access code yet. Issue one so the borrower can view their balance online."}
      </p>
      {code ? (
        <div className="mt-3 rounded-md bg-primary/5 p-3 text-center">
          <p className="text-sm uppercase tracking-wide text-primary">Access code — share it now, it won&apos;t be shown again</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-primary">{code}</p>
          <p className="mt-1 text-sm text-primary">
            Borrower logs in at <span className="font-medium">/portal/login</span> with their mobile number + this code.
          </p>
        </div>
      ) : (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await issueAccessCode(borrowerId);
              if (res.ok) setCode(res.code);
              else setError(res.error);
            })
          }
          className="mt-3 rounded-md border border-primary px-3 py-2 text-base font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
        >
          {pending ? "Issuing…" : hasCode ? "Issue new code" : "Issue access code"}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}
