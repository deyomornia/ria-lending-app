import type { MethodBreakdown } from "../types";
import { splitEvenly } from "../money";

/**
 * Monthly flat / add-on interest (classic "5-6" style):
 * total interest = principal × monthly rate × term in months,
 * principal and interest each split evenly across all payments.
 */
export function flatAddon(
  principal: number,
  ratePerMonthBps: number,
  termPeriods: number,
  termMonths: number
): MethodBreakdown {
  const totalInterest = Math.round((principal * ratePerMonthBps * termMonths) / 10_000);
  return {
    principalDue: splitEvenly(principal, termPeriods),
    interestDue: splitEvenly(totalInterest, termPeriods),
    totalInterest,
  };
}
