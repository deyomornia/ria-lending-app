import { requireStaff } from "@/lib/auth/staff";
import { SignOutButton } from "@/components/staff/SignOutButton";
import { SidebarNav } from "@/components/staff/SidebarNav";
import { isOwnerUp, ROLE_LABELS } from "@/lib/auth/roles";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, user } = await requireStaff();
  const hasTempPassword = user.user_metadata?.temp_password === true;
  const canSeeSettings = isOwnerUp(profile.role);

  return (
    <div className="flex min-h-screen bg-base-200">
      <aside className="bg-neutral text-neutral-content hidden w-60 shrink-0 flex-col sm:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="bg-primary text-primary-content flex h-10 w-10 items-center justify-center rounded-lg text-xl font-bold">
            ₱
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">RIA Lending</p>
            <p className="text-sm opacity-70">
              {profile.full_name.split(" ")[0]} ·{" "}
              {ROLE_LABELS[profile.role] ?? profile.role}
            </p>
          </div>
        </div>
        <SidebarNav showSettings={canSeeSettings} />
        <div className="border-neutral-content/20 space-y-2 border-t px-5 py-4">
          <a
            href="/account/password"
            className="link link-hover block text-sm opacity-80"
          >
            Change password
          </a>
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <div className="bg-neutral text-neutral-content px-4 py-3 sm:hidden">
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
            <div
              role="alert"
              className="alert alert-warning alert-soft mx-auto mb-6 max-w-5xl text-base"
            >
              {/* Single child — daisyUI's alert columnises multiple children. */}
              <p>
                You are still using a temporary password.{" "}
                <a href="/account/password" className="link font-semibold">
                  Set your own password now
                </a>{" "}
                to keep your account secure.
              </p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
