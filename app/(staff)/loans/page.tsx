import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { formatPeso } from "@/lib/interest/money";
import { PageHeader } from "@/components/staff/PageHeader";
import { applySort, SortHeader } from "@/components/staff/SortHeader";
import { statusBadgeClass, statusLabel } from "@/lib/ui/status";

export const metadata = { title: "Loans — RIA Lending" };

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending_approval", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "active", label: "Active" },
  { key: "paid", label: "Paid" },
] as const;

type LoanRow = {
  id: string;
  loan_number: string;
  status: string;
  principal_centavos: number;
  borrowers: { id: string; full_name: string };
  collector: { full_name: string } | null;
};

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { supabase } = await requireStaff();
  const {
    status = "all",
    q = "",
    sort = "created",
    dir: dirRaw = "desc",
  } = await searchParams;
  const dir = dirRaw === "asc" ? ("asc" as const) : ("desc" as const);

  let query = supabase
    .from("loans")
    .select(
      "id, loan_number, status, principal_centavos, borrowers(id, full_name), collector:profiles!loans_collector_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (status !== "all") query = query.eq("status", status);

  const { data } = await query;
  let loans = (data ?? []) as unknown as LoanRow[];

  const needle = q.trim().toLowerCase();
  if (needle) {
    loans = loans.filter(
      (l) =>
        l.loan_number.toLowerCase().includes(needle) ||
        l.borrowers.full_name.toLowerCase().includes(needle),
    );
  }

  const { data: balances } = loans.length
    ? await supabase
        .from("loan_balances")
        .select("loan_id, outstanding_centavos")
        .in(
          "loan_id",
          loans.map((l) => l.id),
        )
    : { data: [] };
  const balanceByLoan = new Map(
    (balances ?? []).map((b) => [b.loan_id, b.outstanding_centavos]),
  );

  loans = applySort(loans, sort, dir, {
    loan_number: (l) => l.loan_number,
    borrower: (l) => l.borrowers.full_name,
    status: (l) => l.status,
    collector: (l) => l.collector?.full_name ?? "",
    principal: (l) => l.principal_centavos,
    outstanding: (l) => balanceByLoan.get(l.id) ?? 0,
  });
  const sortProps = {
    currentSort: sort,
    currentDir: dir,
    basePath: "/loans",
    otherParams: { status, ...(q ? { q } : {}) },
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Loans"
        description="Every loan on record, with balances and assigned collectors."
        action={
          <Link href="/loans/new" className="btn btn-primary">
            + New loan
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-ink-200 p-1">
          {STATUS_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/loans?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={status === t.key ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                status === t.key
                  ? "bg-surface text-ink-900 shadow-sm"
                  : "text-ink-600 hover:text-ink-900"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="filter-bar">
          <input type="hidden" name="status" value={status} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search loans"
            placeholder="Search loan # or borrower…"
            className="field-input w-64"
          />
          <button className="btn btn-primary">Search</button>
        </form>
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <SortHeader label="Loan #" col="loan_number" {...sortProps} />
              <SortHeader label="Borrower" col="borrower" {...sortProps} />
              <SortHeader label="Status" col="status" {...sortProps} />
              <SortHeader label="Collector" col="collector" {...sortProps} />
              <SortHeader
                label="Principal"
                col="principal"
                align="right"
                {...sortProps}
              />
              <SortHeader
                label="Outstanding"
                col="outstanding"
                align="right"
                {...sortProps}
              />
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link
                    href={`/loans/${l.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {l.loan_number}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/borrowers/${l.borrowers.id}`}
                    className="text-ink-900 hover:underline"
                  >
                    {l.borrowers.full_name}
                  </Link>
                </td>
                <td>
                  <span className={statusBadgeClass(l.status)}>
                    {statusLabel(l.status)}
                  </span>
                </td>
                <td className="hidden text-ink-700 md:table-cell">
                  {l.collector?.full_name ?? (
                    <span className="text-ink-500">—</span>
                  )}
                </td>
                <td className="text-right tabular-nums">
                  {formatPeso(l.principal_centavos)}
                </td>
                <td className="text-right font-medium tabular-nums">
                  {formatPeso(balanceByLoan.get(l.id) ?? 0)}
                </td>
              </tr>
            ))}
            {loans.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ink-600">
                  {needle
                    ? "No loans match your search."
                    : "No loans in this category yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
