import type { MethodBreakdown } from "../types";
import { applyBps, splitEvenly } from "../money";

/**
 * Per-period flat rate (daily/weekly hulugan): each payment carries
 * interest = principal × rate-per-period, plus an even share of principal.
 */
export function perPeriodFlat(
  principal: number,
  ratePerPeriodBps: number,
  termPeriods: number
): MethodBreakdown {
  const perRow = applyBps(principal, ratePerPeriodBps);
  return {
    principalDue: splitEvenly(principal, termPeriods),
    interestDue: new Array<number>(termPeriods).fill(perRow),
    totalInterest: perRow * termPeriods,
  };
}
