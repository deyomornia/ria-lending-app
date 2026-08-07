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
    .select(
      "id, full_name, phone, address, loans(id, status, total_payable_centavos)",
    )
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
          <Link href="/borrowers/new" className="btn btn-primary">
            + Add borrower
          </Link>
        }
      />

      <form className="filter-bar mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          aria-label="Search borrowers"
          placeholder="Search by name or phone…"
          className="field-input w-full max-w-sm"
        />
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Active loans</th>
            </tr>
          </thead>
          <tbody>
            {(borrowers ?? []).map((b) => {
              const active = (b.loans ?? []).filter(
                (l) => l.status === "active",
              );
              return (
                <tr key={b.id}>
                  <td>
                    <Link
                      href={`/borrowers/${b.id}`}
                      className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
                    >
                      {b.full_name}
                    </Link>
                  </td>
                  <td className="text-ink-700">{b.phone}</td>
                  <td className="text-ink-700">
                    {active.length > 0
                      ? `${active.length} · ${formatPeso(active.reduce((a, l) => a + l.total_payable_centavos, 0))} payable`
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {(borrowers ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-12 text-center text-ink-500">
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
