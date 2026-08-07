import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { formatPeso } from "@/lib/interest/money";
import { PageHeader } from "@/components/staff/PageHeader";
import { applySort, SortHeader } from "@/components/staff/SortHeader";

export const metadata = { title: "Loans — RIA Lending" };

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending_approval", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "active", label: "Active" },
  { key: "paid", label: "Paid" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  pending_approval: "bg-warning/20 text-warning",
  approved: "bg-info/20 text-info",
  rejected: "bg-error/20 text-error",
  active: "bg-primary/10 text-primary",
  paid: "bg-base-200 text-base-content/70",
  defaulted: "bg-error/20 text-error",
  cancelled: "bg-base-200 text-base-content/60",
  restructured: "bg-warning/20 text-warning",
  draft: "bg-base-200 text-base-content/60",
};

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
  searchParams: Promise<{ status?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const { supabase } = await requireStaff();
  const { status = "all", q = "", sort = "created", dir: dirRaw = "desc" } = await searchParams;
  const dir = dirRaw === "asc" ? "asc" as const : "desc" as const;

  let query = supabase
    .from("loans")
    .select(
      "id, loan_number, status, principal_centavos, borrowers(id, full_name), collector:profiles!loans_collector_id_fkey(full_name)"
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
        l.borrowers.full_name.toLowerCase().includes(needle)
    );
  }

  const { data: balances } = loans.length
    ? await supabase
        .from("loan_balances")
        .select("loan_id, outstanding_centavos")
        .in("loan_id", loans.map((l) => l.id))
    : { data: [] };
  const balanceByLoan = new Map((balances ?? []).map((b) => [b.loan_id, b.outstanding_centavos]));

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
          <Link
            href="/loans/new"
            className="rounded-lg bg-primary px-4 py-2.5 text-base font-semibold text-primary-content shadow-sm hover:bg-secondary"
          >
            + New loan
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-base-300 p-1">
          {STATUS_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/loans?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                status === t.key
                  ? "bg-white text-base-content shadow-sm"
                  : "text-base-content/70 hover:text-base-content"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search loan # or borrower…"
            className="w-64 rounded-md border border-base-300 px-3 py-2 text-base shadow-sm"
          />
          <button className="rounded-md bg-neutral px-3 py-2 text-base font-medium text-neutral-content">
            Search
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-base-300 bg-white shadow-sm">
        <table className="w-full text-base">
          <thead className="bg-base-200 text-left text-sm uppercase tracking-wide text-base-content/70">
            <tr>
              <SortHeader label="Loan #" col="loan_number" {...sortProps} />
              <SortHeader label="Borrower" col="borrower" {...sortProps} />
              <SortHeader label="Status" col="status" {...sortProps} />
              <SortHeader label="Collector" col="collector" {...sortProps} />
              <SortHeader label="Principal" col="principal" align="right" {...sortProps} />
              <SortHeader label="Outstanding" col="outstanding" align="right" {...sortProps} />
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {loans.map((l) => (
              <tr key={l.id} className="hover:bg-base-200">
                <td className="px-4 py-2.5">
                  <Link href={`/loans/${l.id}`} className="font-medium text-primary hover:underline">
                    {l.loan_number}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/borrowers/${l.borrowers.id}`} className="text-base-content hover:underline">
                    {l.borrowers.full_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-sm font-medium capitalize ${STATUS_BADGE[l.status] ?? ""}`}
                  >
                    {l.status === "pending_approval" ? "pending" : l.status}
                  </span>
                </td>
                <td className="hidden px-4 py-2.5 text-base-content/70 md:table-cell">
                  {l.collector?.full_name ?? <span className="text-base-content/50">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatPeso(l.principal_centavos)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {formatPeso(balanceByLoan.get(l.id) ?? 0)}
                </td>
              </tr>
            ))}
            {loans.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-base-content/70">
                  {needle ? "No loans match your search." : "No loans in this category yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
