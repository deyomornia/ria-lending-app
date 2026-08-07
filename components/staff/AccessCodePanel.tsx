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
    <div className="surface-card p-4">
      <h3 className="text-sm font-semibold text-ink-900">
        Debtor portal access
      </h3>
      <p className="mt-1.5 text-sm text-ink-600">
        {hasCode
          ? "This borrower has a portal access code. Issuing a new one replaces it."
          : "No access code yet. Issue one so the borrower can view their balance online."}
      </p>
      {code ? (
        <div className="surface-quiet mt-3 p-3 text-center">
          <p className="text-sm uppercase tracking-wide text-ink-500">
            Access code — share it now, it won&apos;t be shown again
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-[0.3em] text-brand-800">
            {code}
          </p>
          <p className="mt-2 text-sm text-ink-600">
            Borrower logs in at{" "}
            <span className="font-medium text-ink-800">/portal/login</span> with
            their mobile number + this code.
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
          className="btn btn-secondary mt-3 w-full"
        >
          {pending
            ? "Issuing…"
            : hasCode
              ? "Issue new code"
              : "Issue access code"}
        </button>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
