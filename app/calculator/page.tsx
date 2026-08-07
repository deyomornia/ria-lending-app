import Link from "next/link";
import { CalculatorForm } from "@/components/calculator/CalculatorForm";

export const metadata = { title: "Loan Calculator — RIA Lending" };

export default function CalculatorPage() {
  return (
    <main className="min-h-screen bg-base-200">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Loan Calculator</h1>
            <p className="mt-1 text-sm text-base-content/70">
              Compute interest, payments, and the full amortization schedule.
            </p>
          </div>
          <Link
            href="/"
            className="link link-primary text-sm font-medium"
          >
            ← Home
          </Link>
        </div>
        <div className="card card-border border-base-300 bg-base-100 p-6">
          <CalculatorForm />
        </div>
      </div>
    </main>
  );
}
