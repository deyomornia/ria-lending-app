"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError("Invalid email or password.");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand rail — becomes a compact banner on small screens. */}
      <section className="field-dark flex flex-col justify-between px-6 py-8 text-white lg:w-[42%] lg:px-12 lg:py-14">
        <Link href="/" className="flex w-fit items-center gap-3 rounded-lg">
          <span className="peso-mark h-10 w-10 rounded-xl text-xl" aria-hidden>
            ₱
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            RIA Lending
          </span>
        </Link>

        <div className="hidden lg:block">
          <h2 className="max-w-sm text-4xl font-bold leading-[1.1]">
            Keep the book
            <br />
            straight.
          </h2>
          <p className="mt-4 max-w-sm text-lg leading-relaxed text-brand-100/75">
            Releases, collections, and remittances — recorded once, visible to
            everyone who needs them.
          </p>
        </div>

        <p className="hidden text-sm text-brand-200/50 lg:block">
          Authorised staff only. All activity is logged.
        </p>
      </section>

      {/* Form panel */}
      <section className="field-light flex flex-1 items-center justify-center px-5 py-12 lg:py-14">
        <div className="animate-rise w-full max-w-sm">
          <p className="eyebrow text-brand-700">Staff access</p>
          <h1 className="mt-2 text-3xl font-bold text-ink-900">Sign in</h1>
          <p className="mt-2 text-base text-ink-600">
            Use the email address your manager set up for you.
          </p>

          <form
            onSubmit={handleSubmit}
            className="surface-panel mt-7 space-y-5 p-6"
          >
            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.ph"
                className="field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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
              className="btn btn-primary btn-block py-3"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-base text-ink-600">
            Borrower?{" "}
            <Link
              href="/portal/login"
              className="font-semibold text-brand-700 underline-offset-4 hover:underline"
            >
              View your loan here
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
