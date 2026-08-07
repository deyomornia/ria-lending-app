"use client";

import { useEffect, useMemo, useState } from "react";
import { computeSchedule } from "@/lib/interest/engine";
import { formatPeso } from "@/lib/interest/money";
import type {
  InterestMethod,
  LoanTerms,
  PaymentFrequency,
  ScheduleResult,
} from "@/lib/interest/types";
import { todayInManila } from "@/lib/tz";
import { ScheduleTable } from "./ScheduleTable";

const METHOD_LABELS: Record<InterestMethod, string> = {
  flat_addon: "Monthly flat / add-on",
  diminishing: "Diminishing balance",
  one_time_fixed: "One-time fixed interest",
  per_period_flat: "Flat rate per payment (hulugan)",
};

const METHOD_HELP: Record<InterestMethod, string> = {
  flat_addon:
    "Interest = principal × monthly rate × months. The common “5-6” style.",
  diminishing:
    "Bank-style amortization — interest charged only on the remaining balance.",
  one_time_fixed:
    "One agreed interest amount, e.g. borrow ₱10,000 and repay ₱12,000.",
  per_period_flat:
    "Each payment carries interest = principal × rate. Daily/weekly hulugan.",
};

const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  daily: "Daily (hulugan)",
  weekly: "Weekly",
  semi_monthly: "Semi-monthly (15th & end of month)",
  monthly: "Monthly",
};

export type CalculatorState = {
  method: InterestMethod;
  principalPesos: string;
  ratePct: string;
  fixedInterestPesos: string;
  frequency: PaymentFrequency;
  termPeriods: string;
  releaseDate: string;
  firstDueDate: string;
  processingFeePesos: string;
};

export function defaultCalculatorState(): CalculatorState {
  return {
    method: "flat_addon",
    principalPesos: "10000",
    ratePct: "5",
    fixedInterestPesos: "2000",
    frequency: "monthly",
    termPeriods: "6",
    releaseDate: todayInManila(),
    firstDueDate: "",
    processingFeePesos: "",
  };
}

export function stateToTerms(s: CalculatorState): LoanTerms | null {
  const principal = Math.round(parseFloat(s.principalPesos) * 100);
  const termPeriods = parseInt(s.termPeriods, 10);
  if (!Number.isFinite(principal) || principal <= 0) return null;
  if (!Number.isFinite(termPeriods) || termPeriods <= 0) return null;
  const processingFee = s.processingFeePesos
    ? Math.round(parseFloat(s.processingFeePesos) * 100)
    : 0;
  if (!Number.isSafeInteger(processingFee) || processingFee < 0) return null;

  const base = {
    principal,
    frequency: s.frequency,
    termPeriods,
    releaseDate: s.releaseDate,
    firstDueDate: s.firstDueDate || undefined,
    processingFee,
  };

  if (s.method === "one_time_fixed") {
    const fixedInterest = Math.round(parseFloat(s.fixedInterestPesos) * 100);
    if (!Number.isFinite(fixedInterest) || fixedInterest < 0) return null;
    return { ...base, method: "one_time_fixed", fixedInterest };
  }

  const bps = Math.round(parseFloat(s.ratePct) * 100);
  if (!Number.isFinite(bps) || bps < 0) return null;
  if (s.method === "flat_addon")
    return { ...base, method: "flat_addon", ratePerMonthBps: bps };
  if (s.method === "diminishing")
    return { ...base, method: "diminishing", ratePerPeriodBps: bps };
  return { ...base, method: "per_period_flat", ratePerPeriodBps: bps };
}

const inputCls = "field-input";
const labelCls = "field-label";

export function CalculatorForm({
  initial,
  onResult,
  showSchedule = true,
}: {
  initial?: Partial<CalculatorState>;
  /** Called whenever the inputs produce a valid schedule (or null when invalid). */
  onResult?: (terms: LoanTerms | null, result: ScheduleResult | null) => void;
  showSchedule?: boolean;
}) {
  const [s, setS] = useState<CalculatorState>({
    ...defaultCalculatorState(),
    ...initial,
  });

  const { terms, result, error } = useMemo(() => {
    const terms = stateToTerms(s);
    if (!terms) return { terms: null, result: null, error: null };
    try {
      return { terms, result: computeSchedule(terms), error: null };
    } catch (e) {
      return { terms: null, result: null, error: (e as Error).message };
    }
  }, [s]);

  useEffect(() => {
    onResult?.(terms, result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terms, result]);

  const set = (patch: Partial<CalculatorState>) =>
    setS((prev) => ({ ...prev, ...patch }));

  const rateLabel =
    s.method === "flat_addon"
      ? "Interest rate (% per month)"
      : s.method === "diminishing"
        ? "Interest rate (% per payment period)"
        : "Interest rate (% of principal per payment)";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Interest method</label>
          <select
            className={inputCls}
            value={s.method}
            onChange={(e) => set({ method: e.target.value as InterestMethod })}
          >
            {Object.entries(METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="field-hint">{METHOD_HELP[s.method]}</p>
        </div>

        <div>
          <label className={labelCls}>Principal (₱)</label>
          <input
            type="number"
            min="1"
            step="any"
            className={inputCls}
            value={s.principalPesos}
            onChange={(e) => set({ principalPesos: e.target.value })}
          />
        </div>

        {s.method === "one_time_fixed" ? (
          <div>
            <label className={labelCls}>Fixed interest amount (₱)</label>
            <input
              type="number"
              min="0"
              step="any"
              className={inputCls}
              value={s.fixedInterestPesos}
              onChange={(e) => set({ fixedInterestPesos: e.target.value })}
            />
          </div>
        ) : (
          <div>
            <label className={labelCls}>{rateLabel}</label>
            <input
              type="number"
              min="0"
              step="any"
              className={inputCls}
              value={s.ratePct}
              onChange={(e) => set({ ratePct: e.target.value })}
            />
          </div>
        )}

        <div>
          <label className={labelCls}>Payment frequency</label>
          <select
            className={inputCls}
            value={s.frequency}
            onChange={(e) =>
              set({ frequency: e.target.value as PaymentFrequency })
            }
          >
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Number of payments</label>
          <input
            type="number"
            min="1"
            step="1"
            className={inputCls}
            value={s.termPeriods}
            onChange={(e) => set({ termPeriods: e.target.value })}
          />
        </div>

        <div>
          <label className={labelCls}>Release date</label>
          <input
            type="date"
            className={inputCls}
            value={s.releaseDate}
            onChange={(e) => set({ releaseDate: e.target.value })}
          />
        </div>

        <div>
          <label className={labelCls}>
            First due date{" "}
            <span className="font-normal normal-case tracking-normal text-ink-500">
              (optional)
            </span>
          </label>
          <input
            type="date"
            className={inputCls}
            value={s.firstDueDate}
            onChange={(e) => set({ firstDueDate: e.target.value })}
          />
        </div>

        <div>
          <label className={labelCls}>
            Processing fee (₱){" "}
            <span className="font-normal normal-case tracking-normal text-ink-500">
              (deducted from release)
            </span>
          </label>
          <input
            type="number"
            min="0"
            step="any"
            className={inputCls}
            value={s.processingFeePesos}
            onChange={(e) => set({ processingFeePesos: e.target.value })}
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2.5 text-base font-medium text-red-700"
        >
          {error}
        </p>
      )}

      {result && (
        <>
          {/* Hairline grid: one shared border instead of four floating cards. */}
          <div className="surface-quiet grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
            <SummaryCard
              label="Cash released"
              value={formatPeso(result.netRelease)}
            />
            <SummaryCard
              label="Total interest"
              value={formatPeso(result.totalInterest)}
            />
            <SummaryCard
              label="Total payable"
              value={formatPeso(result.totalPayable)}
            />
            <SummaryCard
              label="Per payment"
              value={formatPeso(result.perPaymentAmount)}
              hint={`≈ ${result.effectiveMonthlyRatePct.toFixed(2)}%/mo effective`}
              emphasis
            />
          </div>
          {showSchedule && (
            <section>
              <h2 className="eyebrow mb-2 text-ink-500">Payment schedule</h2>
              <ScheduleTable rows={result.rows} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis ? "bg-brand-700 p-3.5 text-white" : "bg-surface p-3.5"
      }
    >
      <p
        className={`text-xs font-bold uppercase tracking-[0.075em] ${
          emphasis ? "text-brand-100" : "text-ink-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`font-display mt-1 text-xl font-bold tabular-nums ${
          emphasis ? "text-white" : "text-ink-900"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p
          className={`text-xs ${emphasis ? "text-brand-100/85" : "text-ink-500"}`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
