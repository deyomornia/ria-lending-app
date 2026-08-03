import { describe, expect, it } from "vitest";
import { amountInWords } from "@/lib/pdf/amount-words";

describe("amountInWords", () => {
  it("whole pesos", () => {
    expect(amountInWords(1_000_000)).toBe("Ten Thousand Pesos Only");
    expect(amountInWords(1_300_000)).toBe("Thirteen Thousand Pesos Only");
  });
  it("with centavos", () => {
    expect(amountInWords(216_667)).toBe(
      "Two Thousand One Hundred Sixty-Six Pesos and 67/100 Only"
    );
  });
  it("large amounts", () => {
    expect(amountInWords(150_000_000)).toBe(
      "One Million Five Hundred Thousand Pesos Only"
    );
  });
  it("zero", () => {
    expect(amountInWords(0)).toBe("Zero Pesos Only");
  });
});
