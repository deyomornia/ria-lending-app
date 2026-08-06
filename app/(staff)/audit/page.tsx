import Link from "next/link";
import { requireOwner } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/staff/PageHeader";

export const metadata = { title: "Audit Log — RIA Lending" };

const ACTION_LABELS: Record<string, string> = {
  "loan.create": "created a loan",
  "loan.approve": "approved a loan",
  "loan.reject": "rejected a loan",
  "loan.release": "released loan cash",
  "loan.set_collector": "changed a loan's collector",
  "payment.record": "recorded a payment",
  "payment.edit": "edited a payment",
  "payment.void": "voided a payment",
  "penalty.waive": "waived a penalty",
  "penalty.assess": "assessed penalties (system)",
  "borrower.create": "added a borrower",
  "borrower.update": "updated a borrower",
  "access_code.issue": "issued a portal access code",
  "staff.create": "created a staff account",
  "staff.update": "updated a staff account",
  "staff.delete": "deleted a staff account",
  "staff.reset_password": "reset a password",
  "settings.update": "updated company settings",
  "remittance.submit": "submitted a remittance",
  "remittance.confirm": "confirmed a remittance",
  "debtor.login": "borrower logged into the portal",
};

const ENTITY_LINK: Record<string, (id: string) => string> = {
  payments: (id) => `/payments/${id}`,
  loans: (id) => `/loans/${id}`,
  borrowers: (id) => `/borrowers/${id}`,
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireOwner();
  const { q = "" } = await searchParams;

  const admin = createAdminClient();
  let query = admin
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (q.trim()) query = query.ilike("action", `%${q.trim()}%`);
  const { data: entries } = await query;

  const actorIds = [...new Set((entries ?? []).map((e) => e.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Audit log"
        description="Every action in the system — who did what, and when. Latest 200 entries."
        action={
          <form className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Filter by action, e.g. payment"
              className="w-64 rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm"
            />
            <button className="rounded-md bg-slate-900 px-3 py-2 text-base font-medium text-white">
              Filter
            </button>
          </form>
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-200">
          {(entries ?? []).map((e) => {
            const link = e.entity_id ? ENTITY_LINK[e.entity]?.(e.entity_id) : undefined;
            return (
              <li key={e.id} className="px-4 py-3">
                <p className="text-base text-slate-900">
                  <span className="font-medium">
                    {e.actor_id
                      ? (actorName.get(e.actor_id) ?? "Unknown")
                      : e.actor_type === "system"
                        ? "System"
                        : "Borrower"}
                  </span>{" "}
                  {ACTION_LABELS[e.action] ?? e.action}
                  {link && (
                    <Link href={link} className="ml-2 text-sm text-emerald-700 hover:underline">
                      view →
                    </Link>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {new Date(e.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                  <span className="ml-2 font-mono text-slate-500">{e.action}</span>
                </p>
                {e.detail && Object.keys(e.detail).length > 0 && e.action !== "payment.edit" && (
                  <p className="mt-0.5 break-all font-mono text-sm text-slate-500">
                    {JSON.stringify(e.detail).slice(0, 180)}
                  </p>
                )}
              </li>
            );
          })}
          {(entries ?? []).length === 0 && (
            <li className="px-4 py-8 text-center text-base text-slate-600">No entries found.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
