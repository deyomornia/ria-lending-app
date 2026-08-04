import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOwnerUp, isManagerUp, type Role } from "@/lib/auth/roles";

export type StaffProfile = {
  id: string;
  full_name: string;
  role: Role;
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

/** Owner or Super admin. */
export async function requireOwner() {
  const ctx = await requireStaff();
  if (!isOwnerUp(ctx.profile.role)) redirect("/dashboard");
  return ctx;
}

/** Manager, Owner, or Super admin. */
export async function requireManager() {
  const ctx = await requireStaff();
  if (!isManagerUp(ctx.profile.role)) redirect("/dashboard");
  return ctx;
}
