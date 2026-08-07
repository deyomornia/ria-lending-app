import Link from "next/link";
import { CalculatorForm } from "@/components/calculator/CalculatorForm";

export const metadata = { title: "Loan Calculator — RIA Lending" };

export default function CalculatorPage() {
  return (
    <div className="field-light flex min-h-screen flex-col">
      <header className="field-dark text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-3 rounded-lg">
            <span className="peso-mark h-9 w-9 rounded-lg text-lg" aria-hidden>
              ₱
            </span>
            <span className="font-display text-base font-bold tracking-tight">
              RIA Lending
            </span>
          </Link>
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-base text-brand-100/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            ← Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10 sm:py-14">
        <div className="animate-rise max-w-2xl">
          <p className="eyebrow text-brand-700">Free tool · no sign-up</p>
          <h1 className="mt-2 text-3xl font-bold text-ink-900 sm:text-4xl">
            Loan calculator
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-ink-600">
            Compute interest, the per-payment amount, and the full amortization
            schedule — for flat add-on, diminishing balance, one-time fixed, and
            hulugan terms.
          </p>
        </div>

        <div className="surface-panel mt-8 p-5 sm:p-7">
          <CalculatorForm />
        </div>

        <p className="mt-6 text-base text-ink-500">
          Figures are estimates for planning. Your signed loan agreement is the
          final word.
        </p>
      </main>
    </div>
  );
}
