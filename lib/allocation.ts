/**
 * Payment allocation: penalties first (oldest), then schedule items (oldest).
 * Pure and unit-tested; the atomic write happens in the apply_payment SQL
 * function which re-validates against overpayment.
 */

export type OpenObligation = {
  id: string;
  /** amount still owed on this obligation, centavos */
  remaining: number;
};

export type Allocation = { id: string; amount: number };

export type AllocationPlan = {
  penaltyAllocations: Allocation[];
  itemAllocations: Allocation[];
  /** amount left over after every obligation is settled */
  excess: number;
};

export function allocatePayment(
  amount: number,
  openPenalties: OpenObligation[],
  openItems: OpenObligation[]
): AllocationPlan {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`payment amount must be a positive integer, got ${amount}`);
  }
  let left = amount;
  const penaltyAllocations: Allocation[] = [];
  const itemAllocations: Allocation[] = [];

  for (const p of openPenalties) {
    if (left === 0) break;
    const take = Math.min(left, p.remaining);
    if (take > 0) {
      penaltyAllocations.push({ id: p.id, amount: take });
      left -= take;
    }
  }
  for (const item of openItems) {
    if (left === 0) break;
    const take = Math.min(left, item.remaining);
    if (take > 0) {
      itemAllocations.push({ id: item.id, amount: take });
      left -= take;
    }
  }
  return { penaltyAllocations, itemAllocations, excess: left };
}
