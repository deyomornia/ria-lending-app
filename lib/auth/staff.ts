import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffProfile = {
  id: string;
  full_name: string;
  role: "owner" | "staff";
  is_active: boolean;
};

/** Verifies the Supabase session and active profile; redirects to /login otherwise. */
export async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) redirect("/login");

  return { supabase, user, profile: profile as StaffProfile };
}

export async function requireOwner() {
  const ctx = await requireStaff();
  if (ctx.profile.role !== "owner") redirect("/dashboard");
  return ctx;
}
