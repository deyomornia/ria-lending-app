import Link from "next/link";

/**
 * Clickable column header for server-rendered tables. Click toggles
 * ascending/descending via ?sort=&dir= query params.
 */
export function SortHeader({
  label,
  col,
  currentSort,
  currentDir,
  basePath,
  otherParams = {},
  align = "left",
}: {
  label: string;
  col: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  basePath: string;
  otherParams?: Record<string, string>;
  align?: "left" | "right";
}) {
  const active = currentSort === col;
  const nextDir = active && currentDir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams({ ...otherParams, sort: col, dir: nextDir });
  return (
    <th className={`px-4 py-2 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>
      <Link
        href={`${basePath}?${params.toString()}`}
        className={`inline-flex items-center gap-1 hover:text-slate-900 ${active ? "text-slate-900" : ""}`}
      >
        {label}
        <span className="text-xs" aria-hidden>
          {active ? (currentDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </th>
  );
}

export function applySort<T>(
  rows: T[],
  sort: string,
  dir: "asc" | "desc",
  getters: Record<string, (row: T) => string | number>
): T[] {
  const get = getters[sort];
  if (!get) return rows;
  const mul = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
    return String(va).localeCompare(String(vb)) * mul;
  });
}
