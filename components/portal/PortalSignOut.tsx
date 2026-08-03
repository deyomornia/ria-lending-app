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
      className="text-sm text-slate-200 hover:text-white"
    >
      Sign out
    </button>
  );
}
