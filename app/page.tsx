import Link from "next/link";
import type { CSSProperties } from "react";

const rise = (ms: number) => ({ "--rise-delay": `${ms}ms` }) as CSSProperties;

const CAPABILITIES = [
  "Flat, diminishing & hulugan interest",
  "Signed loan agreements",
  "Collector remittances",
  "Manila-time schedules",
];

export default function Home() {
  return (
    <div className="field-dark flex min-h-screen flex-col text-white">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-6">
        <div className="flex items-center gap-3">
          <span className="peso-mark h-10 w-10 rounded-xl text-xl" aria-hidden>
            ₱
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            RIA Lending
          </span>
        </div>
        <Link
          href="/login"
          className="rounded-lg px-3 py-2 text-base font-medium text-brand-100/85 transition-colors hover:bg-white/10 hover:text-white"
        >
          Staff sign-in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-12 sm:py-20">
        <p className="eyebrow animate-rise text-brand-300" style={rise(0)}>
          Philippine lending operations
        </p>

        <h1
          className="animate-rise mt-4 max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl"
          style={rise(60)}
        >
          Every peso,
          <br />
          accounted for.
        </h1>

        <p
          className="animate-rise mt-6 max-w-xl text-lg leading-relaxed text-brand-100/80"
          style={rise(120)}
        >
          Loan book, collections, and borrower records in one place — from the
          cash release to the very last payment.
        </p>

        <div
          className="animate-rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          style={rise(180)}
        >
          <Link
            href="/calculator"
            className="btn btn-primary px-6 py-3.5 text-lg"
          >
            Open the loan calculator
          </Link>
          <Link
            href="/portal/login"
            className="btn btn-on-dark px-6 py-3.5 text-lg"
          >
            Borrower portal
          </Link>
        </div>

        <p
          className="animate-rise mt-4 text-base text-brand-200/70"
          style={rise(240)}
        >
          The calculator is free and needs no sign-up. Borrowers sign in with
          their mobile number.
        </p>

        <ul
          className="animate-rise mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6 text-base text-brand-100/70"
          style={rise(300)}
        >
          {CAPABILITIES.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full bg-brand-400"
                aria-hidden
              />
              {item}
            </li>
          ))}
        </ul>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 pb-8 text-sm text-brand-200/50">
        For lenders, collectors, and borrowers.
      </footer>
    </div>
  );
}
