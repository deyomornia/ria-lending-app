import { PageHeader } from "@/components/staff/PageHeader";
import { createBorrower } from "@/lib/actions/borrowers";
import { BorrowerFields } from "@/components/staff/BorrowerFields";

export const metadata = { title: "Add Borrower — RIA Lending" };

export default function NewBorrowerPage() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Add borrower"
        description="Their mobile number doubles as their portal login."
      />
      <form action={createBorrower} className="surface-card space-y-4 p-6">
        <BorrowerFields />
        <button type="submit" className="btn btn-primary">
          Save borrower
        </button>
      </form>
    </div>
  );
}
