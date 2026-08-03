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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Debtor portal access</h3>
      <p className="mt-1 text-xs text-slate-500">
        {hasCode
          ? "This borrower has a portal access code. Issuing a new one replaces it."
          : "No access code yet. Issue one so the borrower can view their balance online."}
      </p>
      {code ? (
        <div className="mt-3 rounded-md bg-emerald-50 p-3 text-center">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Access code — share it now, it won&apos;t be shown again</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-emerald-800">{code}</p>
          <p className="mt-1 text-xs text-emerald-700">
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
          className="mt-3 rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          {pending ? "Issuing…" : hasCode ? "Issue new code" : "Issue access code"}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
