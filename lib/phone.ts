/** Normalize a Philippine mobile number to +639XXXXXXXXX, or return null. */
export function normalizePhPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  let n = digits;
  if (n.startsWith("+63")) n = n.slice(3);
  else if (n.startsWith("63")) n = n.slice(2);
  else if (n.startsWith("0")) n = n.slice(1);
  if (!/^9\d{9}$/.test(n)) return null;
  return `+63${n}`;
}
