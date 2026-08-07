import type { ScheduleRow } from "@/lib/interest/types";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate } from "@/lib/tz";

export function ScheduleTable({ rows }: { rows: ScheduleRow[] }) {
  return (
    <div className="surface-card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-12">#</th>
            <th>Due date</th>
            <th className="text-right">Principal</th>
            <th className="text-right">Interest</th>
            <th className="text-right">Amount due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.seq}>
              <td className="text-ink-500 tabular-nums">{row.seq}</td>
              <td className="whitespace-nowrap">
                {formatLongDate(row.dueDate)}
              </td>
              <td className="text-right tabular-nums">
                {formatPeso(row.principalDue)}
              </td>
              <td className="text-right tabular-nums">
                {formatPeso(row.interestDue)}
              </td>
              <td className="text-right font-semibold tabular-nums text-ink-900">
                {formatPeso(row.totalDue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
