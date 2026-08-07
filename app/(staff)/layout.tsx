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
  const firstName = profile.full_name.split(" ")[0];
  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role;
  const initials = profile.full_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="field-light flex min-h-screen">
      <aside className="field-dark sticky top-0 hidden h-screen w-64 shrink-0 flex-col sm:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="peso-mark h-10 w-10 rounded-xl text-xl" aria-hidden>
            ₱
          </span>
          <span className="font-display text-lg font-bold leading-tight tracking-tight text-white">
            RIA Lending
          </span>
        </div>

        <SidebarNav showSettings={canSeeSettings} />

        <div className="mt-auto border-t border-white/10 px-4 py-4">
          <div className="mb-3 flex items-center gap-3 px-1">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white"
              aria-hidden
            >
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-white">
                {firstName}
              </span>
              <span className="block truncate text-sm text-brand-200/70">
                {roleLabel}
              </span>
            </span>
          </div>
          <div className="flex flex-col items-start gap-1.5 px-1">
            <a
              href="/account/password"
              className="rounded-md text-base text-brand-100/75 transition-colors hover:text-white"
            >
              Change password
            </a>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile chrome */}
        <div className="field-dark sticky top-0 z-20 px-4 py-3 text-white sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span
                className="peso-mark h-8 w-8 rounded-lg text-base"
                aria-hidden
              >
                ₱
              </span>
              <span className="font-display text-base font-bold tracking-tight">
                RIA Lending
              </span>
            </span>
            <SignOutButton />
          </div>
          <div className="-mx-1 mt-2.5 overflow-x-auto px-1 pb-0.5">
            <SidebarNav compact showSettings={canSeeSettings} />
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {hasTempPassword && (
            <div className="mx-auto mb-6 flex max-w-5xl gap-3 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
              <span aria-hidden>⚠️</span>
              <p>
                You are still using a temporary password.{" "}
                <a
                  href="/account/password"
                  className="font-semibold underline underline-offset-2"
                >
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
