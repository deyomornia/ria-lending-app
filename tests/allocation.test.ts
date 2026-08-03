import { describe, expect, it } from "vitest";
import { allocatePayment } from "@/lib/allocation";

describe("allocatePayment", () => {
  const penalties = [
    { id: "pen1", remaining: 100 },
    { id: "pen2", remaining: 50 },
  ];
  const items = [
    { id: "it1", remaining: 1000 },
    { id: "it2", remaining: 1000 },
  ];

  it("pays penalties first, then oldest items", () => {
    const plan = allocatePayment(1200, penalties, items);
    expect(plan.penaltyAllocations).toEqual([
      { id: "pen1", amount: 100 },
      { id: "pen2", amount: 50 },
    ]);
    expect(plan.itemAllocations).toEqual([{ id: "it1", amount: 1000 }, { id: "it2", amount: 50 }]);
    expect(plan.excess).toBe(0);
  });

  it("partial payment stops mid-item", () => {
    const plan = allocatePayment(500, [], items);
    expect(plan.itemAllocations).toEqual([{ id: "it1", amount: 500 }]);
    expect(plan.excess).toBe(0);
  });

  it("reports excess when everything is settled", () => {
    const plan = allocatePayment(3000, penalties, items);
    expect(plan.excess).toBe(3000 - 150 - 2000);
  });

  it("total allocated always equals amount − excess", () => {
    for (const amt of [1, 149, 150, 151, 2150, 9999]) {
      const plan = allocatePayment(amt, penalties, items);
      const allocated =
        plan.penaltyAllocations.reduce((a, x) => a + x.amount, 0) +
        plan.itemAllocations.reduce((a, x) => a + x.amount, 0);
      expect(allocated + plan.excess).toBe(amt);
    }
  });

  it("rejects non-positive amounts", () => {
    expect(() => allocatePayment(0, [], items)).toThrow();
    expect(() => allocatePayment(-5, [], items)).toThrow();
  });
});
