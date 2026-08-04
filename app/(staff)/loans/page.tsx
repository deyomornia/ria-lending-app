import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { formatPeso } from "@/lib/interest/money";
import { PageHeader } from "@/components/staff/PageHeader";

export const metadata = { title: "Loans — RIA Lending" };

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending_approval", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "active", label: "Active" },
  { key: "paid", label: "Paid" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  pending_approval: "bg-amber-100 text-amber-800",
  approved: "bg-sky-100 text-sky-800",
  rejected: "bg-red-100 text-red-700",
  active: "bg-emerald-100 text-emerald-800",
  paid: "bg-slate-100 text-slate-600",
  defaulted: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
  restructured: "bg-amber-100 text-amber-800",
  draft: "bg-slate-100 text-slate-500",
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
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { supabase } = await requireStaff();
  const { status = "all", q = "" } = await searchParams;

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

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Loans"
        description="Every loan on record, with balances and assigned collectors."
        action={
          <Link
            href="/loans/new"
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            + New loan
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-200 p-1">
          {STATUS_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/loans?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                status === t.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
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
            className="w-64 rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm"
          />
          <button className="rounded-md bg-slate-900 px-3 py-2 text-base font-medium text-white">
            Search
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-sm uppercase tracking-wide text-slate-700">
            <tr>
              <th className="px-4 py-2 font-semibold">Loan #</th>
              <th className="px-4 py-2 font-semibold">Borrower</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="hidden px-4 py-2 font-semibold md:table-cell">Collector</th>
              <th className="px-4 py-2 text-right font-semibold">Principal</th>
              <th className="px-4 py-2 text-right font-semibold">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loans.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/loans/${l.id}`} className="font-medium text-emerald-700 hover:underline">
                    {l.loan_number}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/borrowers/${l.borrowers.id}`} className="text-slate-900 hover:underline">
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
                <td className="hidden px-4 py-2.5 text-slate-700 md:table-cell">
                  {l.collector?.full_name ?? <span className="text-slate-400">—</span>}
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
                <td colSpan={6} className="px-4 py-8 text-center text-slate-600">
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
