import type { ScheduleRow } from "@/lib/interest/types";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate } from "@/lib/tz";

export function ScheduleTable({ rows }: { rows: ScheduleRow[] }) {
  return (
    <div className="overflow-x-auto rounded-box border border-base-300">
      <table className="table table-zebra w-full text-base">
        <thead className="bg-base-200 text-left text-sm uppercase tracking-wide text-base-content/70">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Due date</th>
            <th className="px-3 py-2 text-right">Principal</th>
            <th className="px-3 py-2 text-right">Interest</th>
            <th className="px-3 py-2 text-right">Amount due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-base-300">
          {rows.map((row) => (
            <tr key={row.seq} className="bg-white">
              <td className="px-3 py-2 text-base-content/70">{row.seq}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatLongDate(row.dueDate)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPeso(row.principalDue)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPeso(row.interestDue)}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{formatPeso(row.totalDue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
