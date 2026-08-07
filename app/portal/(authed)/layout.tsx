import { redirect } from "next/navigation";
import { getDebtorSession } from "@/lib/auth/debtor-session";
import { PortalSignOut } from "@/components/portal/PortalSignOut";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const borrowerId = await getDebtorSession();
  if (!borrowerId) redirect("/portal/login");

  return (
    <div className="field-light flex min-h-screen flex-col">
      <header className="field-dark sticky top-0 z-20 text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2.5">
            <span className="peso-mark h-9 w-9 rounded-lg text-lg" aria-hidden>
              ₱
            </span>
            <span className="font-display text-base font-bold leading-tight tracking-tight">
              RIA Lending
              <span className="block text-sm font-normal text-brand-200/70">
                My loans
              </span>
            </span>
          </span>
          <PortalSignOut />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
