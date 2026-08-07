import type { ScheduleResult } from "./types";
import { diffDays } from "./dates";

/**
 * Truth in Lending Act (RA 3765) disclosure figures.
 *
 * The Act requires the creditor to disclose the *finance charge* and the rate
 * that charge actually represents — not the headline rate quoted on the
 * product. A "5% per month add-on" loan repaid in equal instalments costs far
 * more than 60%/yr, because the borrower is paying interest on the full
 * principal while only holding a shrinking part of it.
 *
 * `effectiveMonthlyRatePct` on ScheduleResult is the naive quoted figure
 * (interest ÷ principal ÷ months). These fields are the real ones, derived
 * from the actual cash flows the borrower experiences.
 */
export type DisclosureFigures = {
  /** Cash the borrower actually receives: principal − processing fee. */
  amountFinanced: number;
  /** Everything the borrower pays above the amount financed, in centavos. */
  financeCharge: number;
  /** Finance charge as a % of the amount financed, over the whole term. */
  financeChargePct: number;
  /** Effective annual interest rate — compounding, RA 3765 §4(f). */
  effectiveAnnualRatePct: number;
  /** Effective rate per month, comparable across frequencies. */
  effectiveMonthlyRatePct: number;
  /** Simple annualised rate (daily rate × 365), the US-style APR convention. */
  nominalAnnualRatePct: number;
  /** True when the solver could not converge (degenerate/zero-interest terms). */
  indeterminate: boolean;
};

/** Absolute tolerance on the daily rate, and the bracket we search within. */
const TOLERANCE = 1e-12;
const MAX_DAILY_RATE = 1; // 100%/day — far beyond any real loan
const MAX_ITERATIONS = 200;

/**
 * Net present value of the loan's cash flows at a given daily rate.
 * Positive at t=0 (borrower receives cash), negative on each payment.
 */
function npv(
  dailyRate: number,
  amountFinanced: number,
  flows: { days: number; amount: number }[],
): number {
  let total = amountFinanced;
  for (const flow of flows) {
    total -= flow.amount / Math.pow(1 + dailyRate, flow.days);
  }
  return total;
}

/**
 * Solve for the daily internal rate of return by bisection.
 *
 * Bisection rather than Newton–Raphson: a single inflow at t=0 followed by
 * strictly positive outflows makes NPV monotonically *increasing* in the rate
 * (it starts negative and tends to the amount financed), so a bracketed search
 * always converges — no derivative, no divergence on the aggressive rates
 * common in PH lending.
 */
function solveDailyRate(
  amountFinanced: number,
  flows: { days: number; amount: number }[],
): number | null {
  if (amountFinanced <= 0 || flows.length === 0) return null;

  const totalPaid = flows.reduce((sum, f) => sum + f.amount, 0);
  if (totalPaid <= amountFinanced) return 0; // no finance charge to disclose

  let low = 0;
  let high = MAX_DAILY_RATE;
  if (npv(high, amountFinanced, flows) < 0) return null; // rate exceeds the bracket

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    if (npv(mid, amountFinanced, flows) < 0) low = mid;
    else high = mid;
    if (high - low < TOLERANCE) break;
  }
  return (low + high) / 2;
}

/**
 * Derive the RA 3765 disclosure figures for a computed schedule.
 *
 * Day counts come from the real Manila calendar dates in the schedule, so an
 * irregular first payment period (the borrower picking a first due date) is
 * priced correctly rather than assumed to be a whole period.
 */
export function computeDisclosure(
  schedule: ScheduleResult,
  releaseDate: string,
): DisclosureFigures {
  const amountFinanced = schedule.netRelease;
  const totalPaid = schedule.rows.reduce((sum, row) => sum + row.totalDue, 0);
  const financeCharge = totalPaid - amountFinanced;

  const flows = schedule.rows.map((row) => ({
    days: diffDays(releaseDate, row.dueDate),
    amount: row.totalDue,
  }));

  const dailyRate = solveDailyRate(amountFinanced, flows);
  const financeChargePct =
    amountFinanced > 0 ? (financeCharge / amountFinanced) * 100 : 0;

  if (dailyRate === null) {
    return {
      amountFinanced,
      financeCharge,
      financeChargePct,
      effectiveAnnualRatePct: 0,
      effectiveMonthlyRatePct: 0,
      nominalAnnualRatePct: 0,
      indeterminate: true,
    };
  }

  return {
    amountFinanced,
    financeCharge,
    financeChargePct,
    effectiveAnnualRatePct: (Math.pow(1 + dailyRate, 365) - 1) * 100,
    effectiveMonthlyRatePct: (Math.pow(1 + dailyRate, 365 / 12) - 1) * 100,
    nominalAnnualRatePct: dailyRate * 365 * 100,
    indeterminate: false,
  };
}

/**
 * Rates on informal PH lending routinely run into the thousands of percent
 * once annualised, where "4820.55%" is noise. Round hard above 100%.
 */
export function formatRatePct(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  if (pct >= 1000) return `${Math.round(pct).toLocaleString("en-PH")}%`;
  if (pct >= 100) return `${pct.toFixed(0)}%`;
  return `${pct.toFixed(2)}%`;
}
