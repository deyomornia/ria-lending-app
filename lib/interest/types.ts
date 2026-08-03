export type PaymentFrequency = "daily" | "weekly" | "semi_monthly" | "monthly";

export type InterestMethod =
  | "flat_addon"
  | "diminishing"
  | "one_time_fixed"
  | "per_period_flat";

type LoanTermsBase = {
  /** Principal in centavos */
  principal: number;
  frequency: PaymentFrequency;
  termPeriods: number;
  /** Manila calendar date, YYYY-MM-DD */
  releaseDate: string;
  /** Defaults to one period after releaseDate */
  firstDueDate?: string;
  /** Deducted from the released amount, centavos */
  processingFee?: number;
};

export type LoanTerms = LoanTermsBase &
  (
    | { method: "flat_addon"; ratePerMonthBps: number }
    | { method: "diminishing"; ratePerPeriodBps: number }
    | { method: "one_time_fixed"; fixedInterest: number }
    | { method: "per_period_flat"; ratePerPeriodBps: number }
  );

export type ScheduleRow = {
  seq: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  totalDue: number;
};

export type ScheduleResult = {
  rows: ScheduleRow[];
  totalInterest: number;
  totalPayable: number;
  /** principal − processingFee: cash actually handed to the borrower */
  netRelease: number;
  /** Typical per-payment amount (first row's total) */
  perPaymentAmount: number;
  effectiveMonthlyRatePct: number;
};

/** Per-method output before dates/rows are assembled */
export type MethodBreakdown = {
  principalDue: number[];
  interestDue: number[];
  totalInterest: number;
};
