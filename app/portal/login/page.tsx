"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PortalLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/debtor/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    if (res.ok) {
      router.push("/portal");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Login failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="field-light flex min-h-screen items-center justify-center px-5 py-12">
      <div className="animate-rise w-full max-w-md">
        <div className="text-center">
          <span
            className="peso-mark mx-auto h-14 w-14 rounded-2xl text-2xl"
            aria-hidden
          >
            ₱
          </span>
          <h1 className="mt-5 text-3xl font-bold text-ink-900">
            Borrower Portal
          </h1>
          <p className="mt-2 text-base text-ink-600">
            Check your balance and your next payment date.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="surface-panel mt-8 space-y-6 p-6 sm:p-7"
        >
          <div>
            <label htmlFor="phone" className="field-label">
              Mobile number
            </label>
            <input
              id="phone"
              type="tel"
              required
              placeholder="0917 123 4567"
              autoComplete="tel"
              className="field-input py-3 text-lg"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="code" className="field-label">
              Access code
            </label>
            <input
              id="code"
              type="password"
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="••••••"
              className="field-input py-3 text-center font-mono text-2xl tracking-[0.45em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <p className="field-hint text-center">
              Ask your lender for your 6-digit code if you don&apos;t have one.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2.5 text-base font-medium text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary btn-block py-3.5 text-lg"
          >
            {busy ? "Checking…" : "View my loans"}
          </button>
        </form>

        <p className="mt-6 text-center text-base">
          <Link
            href="/"
            className="font-semibold text-brand-700 underline-offset-4 hover:underline"
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
