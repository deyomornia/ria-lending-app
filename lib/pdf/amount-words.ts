const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    const tens = TENS[Math.floor(n / 10)];
    const ones = n % 10;
    parts.push(ones ? `${tens}-${ONES[ones]}` : tens);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const groups: { value: number; label: string }[] = [
    { value: 1_000_000_000, label: "Billion" },
    { value: 1_000_000, label: "Million" },
    { value: 1_000, label: "Thousand" },
    { value: 1, label: "" },
  ];
  const parts: string[] = [];
  for (const g of groups) {
    const q = Math.floor(n / g.value);
    if (q > 0) {
      parts.push(g.label ? `${belowThousand(q)} ${g.label}` : belowThousand(q));
      n %= g.value;
    }
  }
  return parts.join(" ");
}

/** "PESOS: Twelve Thousand Five Hundred and 50/100 Only" style, from centavos. */
export function amountInWords(centavos: number): string {
  const pesos = Math.floor(centavos / 100);
  const cents = centavos % 100;
  const centsPart = cents > 0 ? ` and ${String(cents).padStart(2, "0")}/100` : "";
  return `${integerToWords(pesos)} Pesos${centsPart} Only`;
}
