import Link from "next/link";
import { CalculatorForm } from "@/components/calculator/CalculatorForm";

export const metadata = { title: "Loan Calculator — RIA Lending" };

export default function CalculatorPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Loan Calculator</h1>
            <p className="mt-1 text-sm text-slate-500">
              Compute interest, payments, and the full amortization schedule.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            ← Home
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <CalculatorForm />
        </div>
      </div>
    </main>
  );
}
