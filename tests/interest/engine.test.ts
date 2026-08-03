import { describe, expect, it } from "vitest";
import { computeSchedule } from "@/lib/interest/engine";
import type { LoanTerms, PaymentFrequency } from "@/lib/interest/types";

const P = (pesos: number) => Math.round(pesos * 100);

function assertInvariants(terms: LoanTerms) {
  const r = computeSchedule(terms);
  const sumPrincipal = r.rows.reduce((a, x) => a + x.principalDue, 0);
  const sumInterest = r.rows.reduce((a, x) => a + x.interestDue, 0);
  const sumTotal = r.rows.reduce((a, x) => a + x.totalDue, 0);
  expect(sumPrincipal).toBe(terms.principal);
  expect(sumInterest).toBe(r.totalInterest);
  expect(sumTotal).toBe(r.totalPayable);
  expect(r.totalPayable).toBe(terms.principal + r.totalInterest);
  expect(r.rows).toHaveLength(terms.termPeriods);
  for (const row of r.rows) {
    expect(row.principalDue).toBeGreaterThanOrEqual(0);
    expect(row.interestDue).toBeGreaterThanOrEqual(0);
    expect(row.totalDue).toBe(row.principalDue + row.interestDue);
  }
  return r;
}

describe("flat_addon (classic 5-6)", () => {
  it("₱10,000 at 5%/mo over 6 monthly payments → ₱3,000 interest", () => {
    const r = assertInvariants({
      method: "flat_addon",
      principal: P(10_000),
      ratePerMonthBps: 500,
      frequency: "monthly",
      termPeriods: 6,
      releaseDate: "2026-08-03",
    });
    expect(r.totalInterest).toBe(P(3_000));
    expect(r.totalPayable).toBe(P(13_000));
    // 13,000 / 6 = 2,166.666… → rows of 2,166.67 with the last reconciling
    expect(r.rows[0].totalDue).toBe(216_667);
    expect(r.rows[5].totalDue).toBe(P(13_000) - 216_667 * 5);
  });

  it("weekly ×8 counts as 2 months of interest", () => {
    const r = assertInvariants({
      method: "flat_addon",
      principal: P(10_000),
      ratePerMonthBps: 500,
      frequency: "weekly",
      termPeriods: 8,
      releaseDate: "2026-08-03",
    });
    expect(r.totalInterest).toBe(P(1_000)); // 5% × 2 months
  });

  it("semi-monthly ×4 counts as 2 months of interest", () => {
    const r = assertInvariants({
      method: "flat_addon",
      principal: P(20_000),
      ratePerMonthBps: 300,
      frequency: "semi_monthly",
      termPeriods: 4,
      releaseDate: "2026-08-03",
    });
    expect(r.totalInterest).toBe(P(1_200)); // 3% × 2 months × 20k
  });
});

describe("one_time_fixed", () => {
  it("borrow ₱10,000 repay ₱12,000 in 4 kinsenas payments of ₱3,000", () => {
    const r = assertInvariants({
      method: "one_time_fixed",
      principal: P(10_000),
      fixedInterest: P(2_000),
      frequency: "semi_monthly",
      termPeriods: 4,
      releaseDate: "2026-08-03",
    });
    expect(r.totalPayable).toBe(P(12_000));
    for (const row of r.rows) expect(row.totalDue).toBe(P(3_000));
  });

  it("single balloon payment when termPeriods = 1", () => {
    const r = assertInvariants({
      method: "one_time_fixed",
      principal: P(5_000),
      fixedInterest: P(500),
      frequency: "monthly",
      termPeriods: 1,
      releaseDate: "2026-08-03",
    });
    expect(r.rows[0].totalDue).toBe(P(5_500));
  });
});

describe("per_period_flat (hulugan)", () => {
  it("₱5,000 daily 40 days at 0.5%/day", () => {
    const r = assertInvariants({
      method: "per_period_flat",
      principal: P(5_000),
      ratePerPeriodBps: 50,
      frequency: "daily",
      termPeriods: 40,
      releaseDate: "2026-08-03",
    });
    expect(r.rows[0].interestDue).toBe(P(25)); // 5,000 × 0.5%
    expect(r.totalInterest).toBe(P(1_000)); // 25 × 40
  });
});

describe("diminishing", () => {
  it("₱50,000 at 3%/mo × 12 matches spreadsheet PMT", () => {
    const r = assertInvariants({
      method: "diminishing",
      principal: P(50_000),
      ratePerPeriodBps: 300,
      frequency: "monthly",
      termPeriods: 12,
      releaseDate: "2026-08-03",
    });
    // PMT(3%,12,-50000) = 5023.098… → each regular row ≈ ₱5,023.10
    expect(r.rows[0].totalDue).toBeGreaterThanOrEqual(502_200);
    expect(r.rows[0].totalDue).toBeLessThanOrEqual(502_400);
    // total interest ≈ ₱10,277.18 (spreadsheet: 12×5023.098 − 50000)
    expect(r.totalInterest).toBeGreaterThanOrEqual(1_027_000);
    expect(r.totalInterest).toBeLessThanOrEqual(1_028_500);
    // interest strictly decreases as balance diminishes
    for (let i = 1; i < r.rows.length; i++) {
      expect(r.rows[i].interestDue).toBeLessThanOrEqual(r.rows[i - 1].interestDue);
    }
  });

  it("zero rate degrades to even principal split", () => {
    const r = assertInvariants({
      method: "diminishing",
      principal: P(12_000),
      ratePerPeriodBps: 0,
      frequency: "monthly",
      termPeriods: 4,
      releaseDate: "2026-08-03",
    });
    expect(r.totalInterest).toBe(0);
    for (const row of r.rows) expect(row.totalDue).toBe(P(3_000));
  });
});

describe("processing fee & validation", () => {
  it("net release deducts the processing fee", () => {
    const r = computeSchedule({
      method: "flat_addon",
      principal: P(10_000),
      ratePerMonthBps: 500,
      frequency: "monthly",
      termPeriods: 3,
      releaseDate: "2026-08-03",
      processingFee: P(300),
    });
    expect(r.netRelease).toBe(P(9_700));
  });

  it("rejects zero principal, non-integer amounts, bad dates", () => {
    const base = {
      method: "flat_addon" as const,
      ratePerMonthBps: 500,
      frequency: "monthly" as const,
      termPeriods: 3,
      releaseDate: "2026-08-03",
    };
    expect(() => computeSchedule({ ...base, principal: 0 })).toThrow();
    expect(() => computeSchedule({ ...base, principal: 100.5 })).toThrow();
    expect(() =>
      computeSchedule({ ...base, principal: P(1_000), releaseDate: "2026-02-30" })
    ).toThrow();
    expect(() =>
      computeSchedule({ ...base, principal: P(1_000), processingFee: P(1_000) })
    ).toThrow();
  });
});

describe("reconciliation property (randomized)", () => {
  // Deterministic LCG so failures are reproducible
  let seed = 42;
  const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648;
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  it("all invariants hold across 500 randomized loans", () => {
    const frequencies: PaymentFrequency[] = ["daily", "weekly", "semi_monthly", "monthly"];
    for (let n = 0; n < 500; n++) {
      const principal = 50_000 + Math.floor(rand() * 100_000_000); // ₱500 – ₱1M
      const frequency = pick(frequencies);
      const termPeriods = 1 + Math.floor(rand() * 60);
      const releaseDate = `202${6 + Math.floor(rand() * 2)}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`;
      const common = { principal, frequency, termPeriods, releaseDate };
      const method = Math.floor(rand() * 4);
      const terms: LoanTerms =
        method === 0
          ? { ...common, method: "flat_addon", ratePerMonthBps: 1 + Math.floor(rand() * 2_000) }
          : method === 1
            ? { ...common, method: "diminishing", ratePerPeriodBps: 1 + Math.floor(rand() * 1_000) }
            : method === 2
              ? { ...common, method: "one_time_fixed", fixedInterest: Math.floor(rand() * principal) }
              : { ...common, method: "per_period_flat", ratePerPeriodBps: 1 + Math.floor(rand() * 300) };
      assertInvariants(terms);
    }
  });
});
