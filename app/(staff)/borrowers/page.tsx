import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { formatPeso } from "@/lib/interest/money";

export const metadata = { title: "Borrowers — RIA Lending" };

export default async function BorrowersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase } = await requireStaff();
  const { q } = await searchParams;

  let query = supabase
    .from("borrowers")
    .select("id, full_name, phone, address, loans(id, status, total_payable_centavos)")
    .order("full_name")
    .limit(200);
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data: borrowers } = await query;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Borrowers</h1>
        <Link
          href="/borrowers/new"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Add borrower
        </Link>
      </div>

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or phone…"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
        />
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Active loans</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(borrowers ?? []).map((b) => {
              const active = (b.loans ?? []).filter((l) => l.status === "active");
              return (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/borrowers/${b.id}`} className="font-medium text-emerald-700">
                      {b.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{b.phone}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {active.length > 0
                      ? `${active.length} · ${formatPeso(active.reduce((a, l) => a + l.total_payable_centavos, 0))} payable`
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {(borrowers ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  No borrowers yet. Add your first borrower to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
