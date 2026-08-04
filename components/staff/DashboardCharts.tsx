import { formatPeso } from "@/lib/interest/money";

/**
 * Server-rendered SVG charts — no client JS, no chart library. Single-hue
 * marks, rounded data-ends, recessive axes, native <title> tooltips.
 */

export function CollectionsBarChart({
  days,
}: {
  days: { date: string; label: string; total: number }[];
}) {
  const W = 560;
  const H = 210;
  const PAD = { top: 26, bottom: 26, left: 8, right: 8 };
  const plotH = H - PAD.top - PAD.bottom;
  const max = Math.max(...days.map((d) => d.total), 1);
  const slot = (W - PAD.left - PAD.right) / days.length;
  const barW = Math.min(44, slot * 0.55);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Collections for the last 7 days. ${days
        .map((d) => `${d.label}: ${formatPeso(d.total)}`)
        .join(", ")}`}
    >
      {/* baseline */}
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={H - PAD.bottom}
        y2={H - PAD.bottom}
        stroke="#cbd5e1"
        strokeWidth="1"
      />
      {days.map((d, i) => {
        const h = Math.round((d.total / max) * (plotH - 8));
        const x = PAD.left + slot * i + (slot - barW) / 2;
        const y = H - PAD.bottom - h;
        const r = Math.min(4, h);
        const isToday = i === days.length - 1;
        return (
          <a key={d.date} href={`/collections?from=${d.date}&to=${d.date}`} aria-label={`View collections for ${d.label}`}>
            <g className="cursor-pointer">
            <title>{`${d.label} — ${formatPeso(d.total)} (click to view)`}</title>
            {h > 0 ? (
              <path
                d={`M${x},${y + r} a${r},${r} 0 0 1 ${r},-${r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} h${-barW} Z`}
                fill={isToday ? "#047857" : "#10b981"}
              />
            ) : (
              <rect x={x} y={H - PAD.bottom - 2} width={barW} height={2} fill="#d1d5db" />
            )}
            {d.total > 0 && (
              <text
                x={x + barW / 2}
                y={y - 7}
                textAnchor="middle"
                fontSize="12.5"
                fill="#334155"
                fontWeight={isToday ? 700 : 400}
              >
                {compactPeso(d.total)}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={H - PAD.bottom + 18}
              textAnchor="middle"
              fontSize="12.5"
              fill="#475569"
              fontWeight={isToday ? 700 : 400}
            >
              {d.label}
            </text>
            </g>
          </a>
        );
      })}
    </svg>
  );
}

export function AgingBar({
  overdue,
  dueToday,
  notYetDue,
}: {
  overdue: number;
  dueToday: number;
  notYetDue: number;
}) {
  const total = overdue + dueToday + notYetDue;
  const segments = [
    { label: "Overdue", value: overdue, color: "#dc2626" },
    { label: "Due today", value: dueToday, color: "#d97706" },
    { label: "Not yet due", value: notYetDue, color: "#10b981" },
  ].filter((s) => s.value > 0);

  if (total <= 0) {
    return <p className="text-base text-slate-600">No outstanding balance — all loans settled.</p>;
  }

  return (
    <div>
      <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded-md" role="img"
        aria-label={`Portfolio: ${segments.map((s) => `${s.label} ${formatPeso(s.value)}`).join(", ")}`}>
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label} — ${formatPeso(s.value)}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-2 text-base text-slate-700">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            {s.label}:&nbsp;
            <span className="font-semibold tabular-nums text-slate-900">{formatPeso(s.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function compactPeso(centavos: number): string {
  const pesos = centavos / 100;
  if (pesos >= 1_000_000) return `₱${(pesos / 1_000_000).toFixed(1)}M`;
  if (pesos >= 10_000) return `₱${Math.round(pesos / 1000)}k`;
  if (pesos >= 1_000) return `₱${(pesos / 1000).toFixed(1)}k`;
  return `₱${Math.round(pesos)}`;
}
