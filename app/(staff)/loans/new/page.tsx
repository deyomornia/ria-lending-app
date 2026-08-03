import { requireStaff } from "@/lib/auth/staff";
import { NewLoanForm } from "@/components/staff/NewLoanForm";

export const metadata = { title: "New Loan — RIA Lending" };

export default async function NewLoanPage({
  searchParams,
}: {
  searchParams: Promise<{ borrower?: string }>;
}) {
  const { supabase } = await requireStaff();
  const { borrower } = await searchParams;

  const { data: borrowers } = await supabase
    .from("borrowers")
    .select("id, full_name, phone")
    .order("full_name");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-xl font-bold text-slate-900">New loan</h1>
      <NewLoanForm borrowers={borrowers ?? []} preselectedBorrowerId={borrower} />
    </div>
  );
}
