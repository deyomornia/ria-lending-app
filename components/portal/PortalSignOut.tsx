"use client";

import { useRouter } from "next/navigation";

export function PortalSignOut() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/debtor/logout", { method: "POST" });
        router.push("/portal/login");
        router.refresh();
      }}
      className="rounded-md px-2 py-1 text-base text-brand-100/80 transition-colors hover:bg-white/10 hover:text-white"
    >
      Sign out
    </button>
  );
}
