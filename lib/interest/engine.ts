import type {
  LoanTerms,
  MethodBreakdown,
  PaymentFrequency,
  ScheduleResult,
  ScheduleRow,
} from "./types";
import { assertCentavos } from "./money";
import { generateDueDates } from "./dates";
import { flatAddon } from "./methods/flat-addon";
import { diminishing } from "./methods/diminishing";
import { oneTimeFixed } from "./methods/one-time-fixed";
import { perPeriodFlat } from "./methods/per-period-flat";

export const PERIODS_PER_MONTH: Record<PaymentFrequency, number> = {
  daily: 30,
  weekly: 4,
  semi_monthly: 2,
  monthly: 1,
};

export function termInMonths(frequency: PaymentFrequency, termPeriods: number): number {
  return termPeriods / PERIODS_PER_MONTH[frequency];
}

/**
 * The single source of truth for loan math. Shared by the public calculator,
 * loan creation, and the agreement PDF. Guaranteed invariants:
 *   Σ principalDue === principal
 *   Σ interestDue  === totalInterest
 *   Σ totalDue     === totalPayable === principal + totalInterest
 */
export function computeSchedule(terms: LoanTerms): ScheduleResult {
  assertCentavos(terms.principal, "principal");
  if (terms.principal === 0) throw new Error("principal must be > 0");
  if (!Number.isInteger(terms.termPeriods) || terms.termPeriods <= 0) {
    throw new Error(`termPeriods must be a positive integer, got ${terms.termPeriods}`);
  }
  const processingFee = terms.processingFee ?? 0;
  assertCentavos(processingFee, "processingFee");
  if (processingFee >= terms.principal) {
    throw new Error("processingFee must be less than the principal");
  }

  const breakdown = computeBreakdown(terms);

  const dueDates = generateDueDates(
    terms.releaseDate,
    terms.frequency,
    terms.termPeriods,
    terms.firstDueDate
  );

  const rows: ScheduleRow[] = dueDates.map((dueDate, idx) => {
    const principalDue = breakdown.principalDue[idx];
    const interestDue = breakdown.interestDue[idx];
    return {
      seq: idx + 1,
      dueDate,
      principalDue,
      interestDue,
      totalDue: principalDue + interestDue,
    };
  });

  const totalPayable = terms.principal + breakdown.totalInterest;
  const months = termInMonths(terms.frequency, terms.termPeriods);
  const effectiveMonthlyRatePct =
    (breakdown.totalInterest / terms.principal / months) * 100;

  return {
    rows,
    totalInterest: breakdown.totalInterest,
    totalPayable,
    netRelease: terms.principal - processingFee,
    perPaymentAmount: rows[0].totalDue,
    effectiveMonthlyRatePct,
  };
}

function computeBreakdown(terms: LoanTerms): MethodBreakdown {
  switch (terms.method) {
    case "flat_addon":
      assertRate(terms.ratePerMonthBps);
      return flatAddon(
        terms.principal,
        terms.ratePerMonthBps,
        terms.termPeriods,
        termInMonths(terms.frequency, terms.termPeriods)
      );
    case "diminishing":
      assertRate(terms.ratePerPeriodBps);
      return diminishing(terms.principal, terms.ratePerPeriodBps, terms.termPeriods);
    case "one_time_fixed":
      assertCentavos(terms.fixedInterest, "fixedInterest");
      return oneTimeFixed(terms.principal, terms.fixedInterest, terms.termPeriods);
    case "per_period_flat":
      assertRate(terms.ratePerPeriodBps);
      return perPeriodFlat(terms.principal, terms.ratePerPeriodBps, terms.termPeriods);
  }
}

function assertRate(bps: number): void {
  if (!Number.isInteger(bps) || bps < 0) {
    throw new Error(`rate must be a non-negative integer in basis points, got ${bps}`);
  }
}
