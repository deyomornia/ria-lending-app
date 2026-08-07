import { formatRatePct } from "@/lib/interest/disclosure";

/**
 * Two bars: what the loan is quoted at, and what it actually costs per month.
 *
 * The gap between them *is* the argument the Truth in Lending Act exists to
 * make, so it gets shown rather than left as two numbers a borrower has to
 * mentally subtract.
 *
 * Bar geometry is computed here from the rates and written inline; the CSS
 * animation only scales toward that already-correct width. Nothing is measured
 * from the DOM at animation time, and with reduced motion the end state is
 * identical.
 */
export function RateGapMeter({
  quotedMonthlyRatePct,
  effectiveMonthlyRatePct,
}: {
  quotedMonthlyRatePct: number;
  effectiveMonthlyRatePct: number;
}) {
  const max = Math.max(quotedMonthlyRatePct, effectiveMonthlyRatePct);
  if (!Number.isFinite(max) || max <= 0) return null;

  const quotedPct = (quotedMonthlyRatePct / max) * 100;
  const effectivePct = (effectiveMonthlyRatePct / max) * 100;

  return (
    <div className="border-t border-base-300 px-5 py-4">
      <p className="mb-3 text-sm font-medium text-base-content/70">
        Monthly cost — quoted vs. actual
      </p>
      <Bar
        label="Quoted"
        value={formatRatePct(quotedMonthlyRatePct)}
        widthPct={quotedPct}
        className="bg-base-content/30"
        delayMs={0}
      />
      <Bar
        label="Actual"
        value={formatRatePct(effectiveMonthlyRatePct)}
        widthPct={effectivePct}
        className="bg-primary"
        delayMs={140}
      />
    </div>
  );
}

function Bar({
  label,
  value,
  widthPct,
  className,
  delayMs,
}: {
  label: string;
  value: string;
  widthPct: number;
  className: string;
  delayMs: number;
}) {
  return (
    <div className="mb-2 flex items-center gap-3 last:mb-0">
      <span className="w-16 shrink-0 text-sm text-base-content/70">{label}</span>
      <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-base-200">
        <span
          className={`animate-grow-x block h-full rounded-full ${className}`}
          style={{ width: `${widthPct}%`, animationDelay: `${delayMs}ms` }}
        />
      </span>
      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}
