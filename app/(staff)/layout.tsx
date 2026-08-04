import { requireStaff } from "@/lib/auth/staff";
import { SignOutButton } from "@/components/staff/SignOutButton";
import { SidebarNav } from "@/components/staff/SidebarNav";
import { isOwnerUp, ROLE_LABELS } from "@/lib/auth/roles";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireStaff();
  const hasTempPassword = user.user_metadata?.temp_password === true;
  const canSeeSettings = isOwnerUp(profile.role);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-60 shrink-0 flex-col bg-emerald-950 text-white sm:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-xl font-bold">
            ₱
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">RIA Lending</p>
            <p className="text-sm text-emerald-200/80">
              {profile.full_name.split(" ")[0]} · {ROLE_LABELS[profile.role] ?? profile.role}
            </p>
          </div>
        </div>
        <SidebarNav showSettings={canSeeSettings} />
        <div className="space-y-2 border-t border-emerald-900 px-5 py-4">
          <a href="/account/password" className="block text-sm text-emerald-200 hover:text-white">
            Change password
          </a>
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <div className="bg-emerald-950 px-4 py-3 text-white sm:hidden">
          <div className="flex items-center justify-between">
            <p className="font-bold">₱ RIA Lending</p>
            <SignOutButton />
          </div>
          <div className="mt-2 overflow-x-auto">
            <SidebarNav compact showSettings={canSeeSettings} />
          </div>
        </div>
        <main className="p-4 sm:p-8">
          {hasTempPassword && (
            <div className="mx-auto mb-6 max-w-5xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
              🔑 You are still using a temporary password.{" "}
              <a href="/account/password" className="font-semibold underline">
                Set your own password now
              </a>{" "}
              to keep your account secure.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
