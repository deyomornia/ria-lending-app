import { describe, expect, it } from "vitest";
import { computeSchedule } from "@/lib/interest/engine";
import { computeDisclosure, formatRatePct } from "@/lib/interest/disclosure";

describe("computeDisclosure", () => {
  it("reports the amount financed net of the processing fee", () => {
    const schedule = computeSchedule({
      method: "flat_addon",
      principal: 1_000_000,
      ratePerMonthBps: 500,
      frequency: "monthly",
      termPeriods: 6,
      releaseDate: "2026-01-15",
      processingFee: 50_000,
    });
    const d = computeDisclosure(schedule, "2026-01-15");

    expect(d.amountFinanced).toBe(950_000);
    // Borrower repays principal + interest but only received principal − fee,
    // so the fee is part of the finance charge.
    expect(d.financeCharge).toBe(schedule.totalPayable - 950_000);
  });

  it("prices an add-on loan well above its quoted rate", () => {
    // ₱10,000 at 5%/month add-on over 6 monthly payments.
    const schedule = computeSchedule({
      method: "flat_addon",
      principal: 1_000_000,
      ratePerMonthBps: 500,
      frequency: "monthly",
      termPeriods: 6,
      releaseDate: "2026-01-15",
    });
    const d = computeDisclosure(schedule, "2026-01-15");

    expect(schedule.effectiveMonthlyRatePct).toBeCloseTo(5, 2); // the quoted figure
    // Amortising means the borrower holds ~half the principal on average, so
    // the true monthly cost is close to double the add-on rate.
    expect(d.effectiveMonthlyRatePct).toBeGreaterThan(8);
    expect(d.effectiveAnnualRatePct).toBeGreaterThan(d.nominalAnnualRatePct);
  });

  it("recovers the exact rate on a single-payment loan", () => {
    // Borrow ₱10,000, repay ₱11,000 in one payment 365 days later.
    const schedule = computeSchedule({
      method: "one_time_fixed",
      principal: 1_000_000,
      fixedInterest: 100_000,
      frequency: "monthly",
      termPeriods: 1,
      releaseDate: "2026-01-15",
      firstDueDate: "2027-01-15",
    });
    const d = computeDisclosure(schedule, "2026-01-15");

    expect(d.effectiveAnnualRatePct).toBeCloseTo(10, 1);
    expect(d.indeterminate).toBe(false);
  });

  it("returns a zero rate when there is no finance charge", () => {
    const schedule = computeSchedule({
      method: "one_time_fixed",
      principal: 1_000_000,
      fixedInterest: 0,
      frequency: "monthly",
      termPeriods: 3,
      releaseDate: "2026-01-15",
    });
    const d = computeDisclosure(schedule, "2026-01-15");

    expect(d.financeCharge).toBe(0);
    expect(d.effectiveAnnualRatePct).toBe(0);
    expect(d.indeterminate).toBe(false);
  });

  it("stays finite on aggressive daily terms", () => {
    // "5-6" style: ₱1,000 daily for 30 days at 20% total.
    const schedule = computeSchedule({
      method: "one_time_fixed",
      principal: 100_000,
      fixedInterest: 20_000,
      frequency: "daily",
      termPeriods: 30,
      releaseDate: "2026-01-15",
    });
    const d = computeDisclosure(schedule, "2026-01-15");

    expect(Number.isFinite(d.effectiveAnnualRatePct)).toBe(true);
    expect(d.effectiveAnnualRatePct).toBeGreaterThan(100);
  });
});

describe("formatRatePct", () => {
  it("keeps two decimals under 100% and drops them above", () => {
    expect(formatRatePct(12.345)).toBe("12.35%");
    expect(formatRatePct(240.6)).toBe("241%");
    expect(formatRatePct(4820.55)).toBe("4,821%");
  });
});
