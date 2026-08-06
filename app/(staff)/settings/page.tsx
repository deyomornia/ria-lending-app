import { PageHeader } from "@/components/staff/PageHeader";
import { StaffAccountsManager } from "@/components/staff/StaffAccountsManager";
import { requireStaff } from "@/lib/auth/staff";
import { isOwnerUp } from "@/lib/auth/roles";
import { updateCompanySettings } from "@/lib/actions/settings";
import { listStaffAccounts } from "@/lib/actions/staff";

export const metadata = { title: "Settings — RIA Lending" };

const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2.5 text-base shadow-sm";
const labelCls = "mb-1 block text-sm font-medium uppercase tracking-wide text-slate-700";

export default async function SettingsPage() {
  const { supabase, profile } = await requireStaff();
  const { data: settings } = await supabase
    .from("company_settings")
    .select("*")
    .eq("id", 1)
    .single();
  const isOwner = isOwnerUp(profile.role);
  const accounts = isOwner ? await listStaffAccounts() : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Company details for printed agreements, and staff account management."
      />
      {isOwner && <StaffAccountsManager accounts={accounts} />}
      <form
        action={updateCompanySettings}
        className="space-y-4 rounded-xl border border-slate-200 bg-white shadow-sm p-6"
      >
        <p className="text-sm text-slate-700">
          Company details shown on the loan agreement PDF.
          {!isOwner && " Only the owner can edit these."}
        </p>
        <div>
          <label className={labelCls}>Company name</label>
          <input
            name="company_name"
            className={inputCls}
            defaultValue={settings?.company_name}
            disabled={!isOwner}
          />
        </div>
        <div>
          <label className={labelCls}>Address</label>
          <input
            name="address"
            className={inputCls}
            defaultValue={settings?.address ?? ""}
            disabled={!isOwner}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Contact number</label>
            <input
              name="contact_number"
              className={inputCls}
              defaultValue={settings?.contact_number ?? ""}
              disabled={!isOwner}
            />
          </div>
          <div>
            <label className={labelCls}>TIN</label>
            <input name="tin" className={inputCls} defaultValue={settings?.tin ?? ""} disabled={!isOwner} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Authorized representative</label>
          <input
            name="representative_name"
            className={inputCls}
            defaultValue={settings?.representative_name ?? ""}
            disabled={!isOwner}
          />
        </div>
        {isOwner && (
          <button className="rounded-md bg-emerald-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-800">
            Save settings
          </button>
        )}
      </form>

    </div>
  );
}
