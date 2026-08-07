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
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  type AssignableRole,
} from "@/lib/auth/roles";

const inputCls = "field-input py-2";
const labelCls = "field-label";
const btnSecondary = "btn btn-secondary px-3 py-1.5 text-sm";
/* No .btn-danger token exists yet, so destructive actions layer red on .btn
   to keep radius, typography, and disabled behaviour consistent. */
const btnDangerSolid =
  "btn bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700";
const btnDangerQuiet =
  "btn border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50";

export function StaffAccountsManager({
  accounts,
}: {
  accounts: StaffAccount[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [revealed, setRevealed] = useState<{
    email: string;
    password: string;
  } | null>(null);
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
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-4">
        <div className="min-w-0 max-w-prose">
          <h2 className="text-base font-semibold text-ink-900">
            Staff accounts
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Owners control everything. Managers approve loans and monitor
            collectors. Collectors propose loans, encode borrowers, and record
            collections.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="btn btn-primary px-3 py-2 text-sm"
        >
          {showAdd ? "Close" : "+ Add account"}
        </button>
      </div>

      {notice && (
        <p
          className={`mx-4 mt-3 rounded-field px-3 py-2 text-sm ${
            notice.kind === "ok"
              ? "bg-brand-50 text-brand-800"
              : "surface-danger"
          }`}
        >
          {notice.text}
        </p>
      )}

      {revealed && (
        <div className="mx-4 mt-3 rounded-card border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          Temporary password for{" "}
          <span className="font-semibold">{revealed.email}</span> — share it
          now, it won&apos;t be shown again:{" "}
          <code className="rounded-field bg-white px-2 py-0.5 font-mono text-base font-bold tracking-wide">
            {revealed.password}
          </code>
          <button
            className="ml-3 font-medium underline underline-offset-2"
            onClick={() => setRevealed(null)}
          >
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
                setRevealed({
                  email: input.email,
                  password: res.value.password,
                });
                setShowAdd(false);
              }
              done(res, `Account created for ${input.email}.`);
            })
          }
        />
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th className="hidden md:table-cell">Email</th>
            <th>Role</th>
            <th>Status</th>
            <th className="text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
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
              <tr
                key={a.id}
                className={a.is_active ? "" : "bg-sunken opacity-70"}
              >
                <td className="font-medium text-ink-900">
                  {a.full_name}
                  {a.isSuperAdmin && (
                    <span className="badge badge-success ml-2 normal-case">
                      Super admin
                    </span>
                  )}
                </td>
                <td className="hidden text-ink-700 md:table-cell">{a.email}</td>
                <td className="text-ink-700">
                  {ROLE_LABELS[a.role] ?? a.role}
                </td>
                <td>
                  <span
                    className={
                      a.is_active
                        ? "badge badge-success"
                        : "badge badge-neutral"
                    }
                  >
                    {a.is_active ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap justify-end gap-2">
                    {!a.isSuperAdmin && (
                      <button
                        className={btnSecondary}
                        onClick={() => setEditingId(a.id)}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      className={btnSecondary}
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await resetStaffPassword(a.id);
                          if (res.ok)
                            setRevealed({
                              email: a.email,
                              password: res.value.password,
                            });
                          done(res, `Password reset for ${a.email}.`);
                        })
                      }
                    >
                      Reset password
                    </button>
                    {!a.isSuperAdmin &&
                      (confirmDeleteId === a.id ? (
                        <button
                          className={btnDangerSolid}
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
                          className={btnDangerQuiet}
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
            ),
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
    /* The `bg-slate-50` class here is the smoke-test anchor for the add-account
       panel (`div.bg-slate-50` must stay unique on /settings) — do not swap it
       for a token utility. */
    <div className="border-b border-line bg-slate-50 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Full name *</label>
          <input
            className={inputCls}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
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
            Password{" "}
            <span className="normal-case text-ink-500">
              (leave blank to auto-generate)
            </span>
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
        onClick={() =>
          onSubmit({ fullName, email, role, password: password || undefined })
        }
        className="btn btn-primary mt-3 py-2 text-sm"
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
  onSave: (input: {
    fullName: string;
    role: AssignableRole;
    isActive: boolean;
  }) => void;
}) {
  const [fullName, setFullName] = useState(account.full_name);
  const [role, setRole] = useState<AssignableRole>(
    account.role === "super_admin" || account.role === "staff"
      ? "collector"
      : account.role,
  );
  const [isActive, setIsActive] = useState(account.is_active);

  return (
    <tr className="bg-brand-50">
      <td>
        <input
          className={inputCls}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </td>
      <td className="hidden text-ink-700 md:table-cell">{account.email}</td>
      <td>
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
      <td>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-5 w-5 accent-brand-700"
          />
          Active
        </label>
      </td>
      <td>
        <div className="flex justify-end gap-2">
          <button
            className="btn btn-primary px-3 py-1.5 text-sm"
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
