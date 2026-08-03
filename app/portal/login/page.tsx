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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-2xl font-bold text-white shadow-sm">₱</div>
          <h1 className="text-2xl font-bold text-slate-900">Borrower Portal</h1>
          <p className="mt-1 text-sm text-slate-700">
            View your loan balance and upcoming payments
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-medium uppercase tracking-wide text-slate-700">
              Mobile number
            </label>
            <input
              type="tel"
              required
              placeholder="0917 123 4567"
              autoComplete="tel"
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium uppercase tracking-wide text-slate-700">
              Access code
            </label>
            <input
              type="password"
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="6-digit code"
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-center font-mono text-lg tracking-[0.4em] shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <p className="mt-1 text-sm text-slate-600">
              Ask your lender for your access code if you don&apos;t have one.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {busy ? "Checking…" : "View my loans"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-700">
          <Link href="/" className="font-medium text-emerald-700">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
