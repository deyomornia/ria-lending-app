"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="rounded-md text-left text-base text-brand-100/75 transition-colors hover:text-white"
    >
      Sign out
    </button>
  );
}
