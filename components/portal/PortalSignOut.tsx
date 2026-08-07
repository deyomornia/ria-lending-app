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
      className="text-sm text-neutral-content/70 hover:text-neutral-content"
    >
      Sign out
    </button>
  );
}
