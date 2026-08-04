"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createStaffAccount,
  deleteStaffAccount,
  resetStaffPassword,
  updateStaffAccount,
  type StaffAccount,
} from "@/lib/actions/staff";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AssignableRole } from "@/lib/auth/roles";

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";
const labelCls = "mb-1 block text-sm font-medium uppercase tracking-wide text-slate-700";
const btnSecondary =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function StaffAccountsManager({ accounts }: { accounts: StaffAccount[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [revealed, setRevealed] = useState<{ email: string; password: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();

  function done(res: { ok: boolean; error?: string }, okText: string) {
    if (res.ok) {
      setNotice({ kind: "ok", text: okText });
      router.refresh();
    } else {
      setNotice({ kind: "error", text: res.error ?? "Something went wrong." });
    }
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Staff accounts</h2>
          <p className="text-sm text-slate-600">
            Owners control everything. Managers approve loans and monitor collectors.
            Collectors propose loans, encode borrowers, and record collections.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          {showAdd ? "Close" : "+ Add account"}
        </button>
      </div>

      {notice && (
        <p
          className={`mx-4 mt-3 rounded-md px-3 py-2 text-sm ${
            notice.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {notice.text}
        </p>
      )}

      {revealed && (
        <div className="mx-4 mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Temporary password for <span className="font-semibold">{revealed.email}</span> — share it
          now, it won&apos;t be shown again:{" "}
          <code className="rounded bg-white px-2 py-0.5 font-mono text-base font-bold">
            {revealed.password}
          </code>
          <button className="ml-3 underline" onClick={() => setRevealed(null)}>
            Dismiss
          </button>
        </div>
      )}

      {showAdd && (
        <AddAccountForm
          pending={pending}
          onSubmit={(input) =>
            startTransition(async () => {
              const res = await createStaffAccount(input);
              if (res.ok) {
                setRevealed({ email: input.email, password: res.value.password });
                setShowAdd(false);
              }
              done(res, `Account created for ${input.email}.`);
            })
          }
        />
      )}

      <table className="w-full text-base">
        <thead className="bg-slate-50 text-left text-sm uppercase tracking-wide text-slate-700">
          <tr>
            <th className="px-4 py-2 font-semibold">Name</th>
            <th className="hidden px-4 py-2 font-semibold md:table-cell">Email</th>
            <th className="px-4 py-2 font-semibold">Role</th>
            <th className="px-4 py-2 font-semibold">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {accounts.map((a) =>
            editingId === a.id ? (
              <EditRow
                key={a.id}
                account={a}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSave={(input) =>
                  startTransition(async () => {
                    const res = await updateStaffAccount(a.id, input);
                    if (res.ok) setEditingId(null);
                    done(res, `${input.fullName} updated.`);
                  })
                }
              />
            ) : (
              <tr key={a.id} className={a.is_active ? "" : "bg-slate-50 opacity-70"}>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {a.full_name}
                  {a.isSuperAdmin && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-sm font-semibold text-emerald-800">
                      Super admin
                    </span>
                  )}
                </td>
                <td className="hidden px-4 py-2.5 text-slate-700 md:table-cell">{a.email}</td>
                <td className="px-4 py-2.5 text-slate-700">{ROLE_LABELS[a.role] ?? a.role}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-sm font-medium ${
                      a.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {a.is_active ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap justify-end gap-2">
                    {!a.isSuperAdmin && (
                      <button className={btnSecondary} onClick={() => setEditingId(a.id)}>
                        Edit
                      </button>
                    )}
                    <button
                      className={btnSecondary}
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await resetStaffPassword(a.id);
                          if (res.ok) setRevealed({ email: a.email, password: res.value.password });
                          done(res, `Password reset for ${a.email}.`);
                        })
                      }
                    >
                      Reset password
                    </button>
                    {!a.isSuperAdmin &&
                      (confirmDeleteId === a.id ? (
                        <button
                          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              const res = await deleteStaffAccount(a.id);
                              setConfirmDeleteId(null);
                              done(res, `${a.email} deleted.`);
                            })
                          }
                        >
                          Confirm delete?
                        </button>
                      ) : (
                        <button
                          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setConfirmDeleteId(a.id);
                            setTimeout(() => setConfirmDeleteId(null), 4000);
                          }}
                        >
                          Delete
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddAccountForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (input: {
    fullName: string;
    email: string;
    role: AssignableRole;
    password?: string;
  }) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("collector");
  const [password, setPassword] = useState("");

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Full name *</label>
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Email *</label>
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Role</label>
          <select
            className={inputCls}
            value={role}
            onChange={(e) => setRole(e.target.value as AssignableRole)}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>
            Password <span className="normal-case text-slate-500">(leave blank to auto-generate)</span>
          </label>
          <input
            type="text"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Auto-generate"
          />
        </div>
      </div>
      <button
        disabled={pending || !fullName.trim() || !email.trim()}
        onClick={() => onSubmit({ fullName, email, role, password: password || undefined })}
        className="mt-3 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create account"}
      </button>
    </div>
  );
}

function EditRow({
  account,
  pending,
  onCancel,
  onSave,
}: {
  account: StaffAccount;
  pending: boolean;
  onCancel: () => void;
  onSave: (input: { fullName: string; role: AssignableRole; isActive: boolean }) => void;
}) {
  const [fullName, setFullName] = useState(account.full_name);
  const [role, setRole] = useState<AssignableRole>(
    account.role === "super_admin" || account.role === "staff" ? "collector" : account.role
  );
  const [isActive, setIsActive] = useState(account.is_active);

  return (
    <tr className="bg-emerald-50/50">
      <td className="px-4 py-2.5">
        <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </td>
      <td className="hidden px-4 py-2.5 text-slate-700 md:table-cell">{account.email}</td>
      <td className="px-4 py-2.5">
        <select
          className={inputCls}
          value={role}
          onChange={(e) => setRole(e.target.value as AssignableRole)}
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2.5">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-5 w-5 accent-emerald-700"
          />
          Active
        </label>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex justify-end gap-2">
          <button
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            disabled={pending}
            onClick={() => onSave({ fullName, role, isActive })}
          >
            Save
          </button>
          <button className={btnSecondary} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
