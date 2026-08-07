import { redirect } from "next/navigation";
import { getDebtorSession } from "@/lib/auth/debtor-session";
import { PortalSignOut } from "@/components/portal/PortalSignOut";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const borrowerId = await getDebtorSession();
  if (!borrowerId) redirect("/portal/login");

  return (
    <div className="min-h-screen bg-base-200">
      <header className="flex items-center justify-between bg-neutral px-4 py-3 text-neutral-content">
        <p className="font-bold">RIA Lending · My Loans</p>
        <PortalSignOut />
      </header>
      <main className="mx-auto max-w-2xl p-4">{children}</main>
    </div>
  );
}
