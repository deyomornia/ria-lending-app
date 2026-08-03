import type { MethodBreakdown } from "../types";
import { splitEvenly } from "../money";

/**
 * One-time fixed interest: a single agreed interest amount regardless of term
 * (borrow ₱10,000, repay ₱12,000). Principal and interest split evenly across
 * payments; a 1-period term is a balloon payment.
 */
export function oneTimeFixed(
  principal: number,
  fixedInterest: number,
  termPeriods: number
): MethodBreakdown {
  return {
    principalDue: splitEvenly(principal, termPeriods),
    interestDue: splitEvenly(fixedInterest, termPeriods),
    totalInterest: fixedInterest,
  };
}
