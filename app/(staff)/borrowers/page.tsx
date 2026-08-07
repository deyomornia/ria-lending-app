import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { formatPeso } from "@/lib/interest/money";
import { PageHeader } from "@/components/staff/PageHeader";

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
      <PageHeader
        title="Borrowers"
        description="Everyone you lend to, with their active loans and portal access."
        action={
          <Link
            href="/borrowers/new"
            className="rounded-lg bg-primary px-4 py-2.5 text-base font-semibold text-primary-content shadow-sm hover:bg-secondary"
          >
            + Add borrower
          </Link>
        }
      />

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or phone…"
          className="w-full max-w-sm rounded-md border border-base-300 px-3 py-2.5 text-base shadow-sm"
        />
      </form>

      <div className="overflow-hidden rounded-xl border border-base-300 bg-white shadow-sm">
        <table className="w-full text-base">
          <thead className="bg-base-200 text-left text-sm uppercase tracking-wide text-base-content/70">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Active loans</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {(borrowers ?? []).map((b) => {
              const active = (b.loans ?? []).filter((l) => l.status === "active");
              return (
                <tr key={b.id} className="hover:bg-base-200">
                  <td className="px-4 py-2">
                    <Link href={`/borrowers/${b.id}`} className="font-medium text-primary">
                      {b.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-base-content/70">{b.phone}</td>
                  <td className="px-4 py-2 text-base-content/70">
                    {active.length > 0
                      ? `${active.length} · ${formatPeso(active.reduce((a, l) => a + l.total_payable_centavos, 0))} payable`
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {(borrowers ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-base-content/70">
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
