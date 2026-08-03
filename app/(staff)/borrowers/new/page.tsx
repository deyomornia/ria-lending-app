import { createBorrower } from "@/lib/actions/borrowers";
import { BorrowerFields } from "@/components/staff/BorrowerFields";

export const metadata = { title: "Add Borrower — RIA Lending" };

export default function NewBorrowerPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-xl font-bold text-slate-900">Add borrower</h1>
      <form
        action={createBorrower}
        className="space-y-4 rounded-xl border border-slate-300 bg-white p-6"
      >
        <BorrowerFields />
        <button
          type="submit"
          className="rounded-md bg-emerald-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-800"
        >
          Save borrower
        </button>
      </form>
    </div>
  );
}
