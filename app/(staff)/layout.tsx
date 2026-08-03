import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { SignOutButton } from "@/components/staff/SignOutButton";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/borrowers", label: "Borrowers" },
  { href: "/loans/new", label: "New Loan" },
  { href: "/collections", label: "Collections" },
  { href: "/settings", label: "Settings" },
];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-56 shrink-0 flex-col bg-slate-900 text-white sm:flex">
        <div className="px-5 py-6">
          <p className="text-lg font-bold">RIA Lending</p>
          <p className="text-xs text-slate-400">
            {profile.full_name} · {profile.role}
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex-1">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white sm:hidden">
          <p className="font-bold">RIA Lending</p>
          <nav className="flex gap-3 text-xs">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-slate-200">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <main className="p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
