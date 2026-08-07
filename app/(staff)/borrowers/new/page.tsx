import { PageHeader } from "@/components/staff/PageHeader";
import { createBorrower } from "@/lib/actions/borrowers";
import { BorrowerFields } from "@/components/staff/BorrowerFields";

export const metadata = { title: "Add Borrower — RIA Lending" };

export default function NewBorrowerPage() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Add borrower" description="Their mobile number doubles as their portal login." />
      <form
        action={createBorrower}
        className="space-y-4 rounded-xl border border-base-300 bg-white shadow-sm p-6"
      >
        <BorrowerFields />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2.5 text-base font-semibold text-primary-content hover:bg-secondary"
        >
          Save borrower
        </button>
      </form>
    </div>
  );
}
