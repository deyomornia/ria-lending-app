import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-white">RIA Lending</h1>
        <p className="mt-2 text-sm text-slate-400">
          Loan management for lenders, collectors, and borrowers.
        </p>
        <div className="mt-8 space-y-3">
          <Link
            href="/calculator"
            className="block rounded-xl bg-emerald-600 px-6 py-4 font-semibold text-white hover:bg-emerald-500"
          >
            🧮 Loan Calculator
            <span className="block text-xs font-normal text-emerald-100">
              Compute interest and payment schedules — free to use
            </span>
          </Link>
          <Link
            href="/portal/login"
            className="block rounded-xl bg-slate-700 px-6 py-4 font-semibold text-white hover:bg-slate-600"
          >
            👤 Borrower Portal
            <span className="block text-xs font-normal text-slate-300">
              View your balance and upcoming payments
            </span>
          </Link>
          <Link
            href="/login"
            className="block rounded-xl border border-slate-700 px-6 py-4 font-semibold text-slate-300 hover:bg-slate-800"
          >
            Staff sign-in
          </Link>
        </div>
      </div>
    </main>
  );
}
