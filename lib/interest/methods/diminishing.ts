import type { MethodBreakdown } from "../types";

/**
 * Diminishing-balance amortization: fixed payment, interest computed on the
 * remaining principal each period. The last row pays the exact remaining
 * balance so principal always reconciles to the centavo.
 */
export function diminishing(
  principal: number,
  ratePerPeriodBps: number,
  termPeriods: number
): MethodBreakdown {
  const i = ratePerPeriodBps / 10_000;
  const pmt =
    i === 0
      ? principal / termPeriods
      : (principal * i) / (1 - Math.pow(1 + i, -termPeriods));

  const principalDue: number[] = [];
  const interestDue: number[] = [];
  let remaining = principal;

  for (let k = 0; k < termPeriods; k++) {
    const interest = Math.round(remaining * i);
    let principalPart: number;
    if (k === termPeriods - 1) {
      principalPart = remaining;
    } else {
      principalPart = Math.min(Math.round(pmt) - interest, remaining);
      if (principalPart < 0) principalPart = 0;
    }
    principalDue.push(principalPart);
    interestDue.push(interest);
    remaining -= principalPart;
  }

  const totalInterest = interestDue.reduce((a, b) => a + b, 0);
  return { principalDue, interestDue, totalInterest };
}
