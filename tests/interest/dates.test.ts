import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonthsClamped,
  defaultFirstDueDate,
  generateDueDates,
  nextSemiMonthly,
} from "@/lib/interest/dates";

describe("semi-monthly (kinsenas/katapusan)", () => {
  it("alternates 15th and end-of-month", () => {
    expect(generateDueDates("2026-08-03", "semi_monthly", 5)).toEqual([
      "2026-08-15",
      "2026-08-31",
      "2026-09-15",
      "2026-09-30",
      "2026-10-15",
    ]);
  });

  it("handles February end-of-month, leap and non-leap", () => {
    expect(nextSemiMonthly("2026-02-15")).toBe("2026-02-28");
    expect(nextSemiMonthly("2028-02-15")).toBe("2028-02-29"); // leap
    expect(nextSemiMonthly("2026-02-28")).toBe("2026-03-15");
  });

  it("release on the 15th rolls to end of month", () => {
    expect(defaultFirstDueDate("2026-08-15", "semi_monthly")).toBe("2026-08-31");
  });
});

describe("monthly clamping", () => {
  it("Jan 31 anchor clamps through Feb and restores in longer months", () => {
    expect(generateDueDates("2025-12-31", "monthly", 4)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("leap-year February clamps to the 29th", () => {
    expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("year rollover works", () => {
    expect(addMonthsClamped("2026-11-15", 2)).toBe("2027-01-15");
  });
});

describe("daily & weekly", () => {
  it("daily crosses month boundaries", () => {
    expect(generateDueDates("2026-08-30", "daily", 3)).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });

  it("weekly steps 7 days", () => {
    expect(generateDueDates("2026-08-03", "weekly", 2)).toEqual([
      "2026-08-10",
      "2026-08-17",
    ]);
  });

  it("addDays handles year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("explicit first due date", () => {
  it("is respected and anchors the rest of the schedule", () => {
    expect(generateDueDates("2026-08-03", "monthly", 3, "2026-09-05")).toEqual([
      "2026-09-05",
      "2026-10-05",
      "2026-11-05",
    ]);
  });
});
