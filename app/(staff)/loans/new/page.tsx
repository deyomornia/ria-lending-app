import { PageHeader } from "@/components/staff/PageHeader";
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

  const [{ data: borrowers }, { data: collectors }] = await Promise.all([
    supabase.from("borrowers").select("id, full_name, phone").order("full_name"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New loan" description="Pick the borrower, set the terms, preview the schedule, then activate." />
      <NewLoanForm
        borrowers={borrowers ?? []}
        collectors={collectors ?? []}
        preselectedBorrowerId={borrower}
      />
    </div>
  );
}
