/** Integer-centavo money helpers. All amounts are non-negative integers. */

export function assertCentavos(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer amount in centavos, got ${value}`);
  }
}

/**
 * Split `total` centavos into `parts` amounts that sum exactly to `total`.
 * Every part is the rounded even share; the LAST part absorbs the rounding
 * difference so the sum always reconciles.
 */
export function splitEvenly(total: number, parts: number): number[] {
  if (parts <= 0) throw new Error(`parts must be > 0, got ${parts}`);
  const share = Math.round(total / parts);
  const out = new Array<number>(parts).fill(share);
  out[parts - 1] = total - share * (parts - 1);
  return out;
}

/** Apply a basis-point rate to a centavo amount, rounded to the centavo. */
export function applyBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10_000);
}

export function formatPeso(centavos: number): string {
  const sign = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  const pesos = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, "0");
  return `${sign}₱${pesos.toLocaleString("en-PH")}.${cents}`;
}
