"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLoanCollector } from "@/lib/actions/loans";

export function CollectorSelect({
  loanId,
  collectors,
  currentCollectorId,
}: {
  loanId: string;
  collectors: { id: string; full_name: string }[];
  currentCollectorId: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentCollectorId ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm text-ink-700">
      <span className="font-medium uppercase tracking-wide">Collector</span>
      <select
        className="rounded-field border border-line-strong bg-surface px-2 py-1.5 text-base text-ink-900 shadow-xs hover:border-ink-400 disabled:opacity-60"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          startTransition(async () => {
            const res = await setLoanCollector(loanId, next || null);
            if (!res.ok) {
              alert(res.error);
              setValue(currentCollectorId ?? "");
            }
            router.refresh();
          });
        }}
      >
        <option value="">— None —</option>
        {collectors.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name}
          </option>
        ))}
      </select>
    </label>
  );
}
