"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputCls = "field-input";
const labelCls = "field-label";

export function ChangePasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8)
      return setError("New password must be at least 8 characters.");
    if (next !== confirm)
      return setError("New password and confirmation do not match.");
    if (next === current)
      return setError(
        "The new password must be different from the current one.",
      );
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      // Re-authenticate to prove the current password before allowing a change
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (verifyErr) {
        setError("Current password is incorrect.");
        return;
      }
      const { error: updateErr } = await supabase.auth.updateUser({
        password: next,
        data: { temp_password: false },
      });
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      setSuccess(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      router.refresh();
    });
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-semibold text-emerald-800">
          Password changed ✓
        </p>
        <p className="mt-1 text-base text-emerald-700">
          Use your new password the next time you sign in.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label className={labelCls}>Current password</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          className={inputCls}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls}>New password</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputCls}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <p className="mt-1 text-sm text-slate-600">
          At least 8 characters. Use something only you know.
        </p>
      </div>
      <div>
        <label className={labelCls}>Confirm new password</label>
        <input
          type="password"
          required
          autoComplete="new-password"
          className={inputCls}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
