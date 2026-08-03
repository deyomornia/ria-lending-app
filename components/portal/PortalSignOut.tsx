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
      className="text-xs text-slate-300 hover:text-white"
    >
      Sign out
    </button>
  );
}
