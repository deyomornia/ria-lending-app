"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { requireOwner } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";

/** This account can never be demoted, deactivated, or deleted. */
const SUPER_ADMIN_EMAIL = "deodexter95@gmail.com";

export type StaffAccount = {
  id: string;
  full_name: string;
  email: string;
  role: "owner" | "staff";
  is_active: boolean;
  isSuperAdmin: boolean;
};

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { value?: never } : { value: T }))
  | { ok: false; error: string };

function generatePassword(): string {
  // 12 chars, unambiguous alphabet, plus a suffix to satisfy complexity rules
  const alphabet = "abcdefghjkmnpqrstuvwxyzACDEFHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out.slice(0, 4) + "-" + out.slice(4, 8) + "-" + out.slice(8, 12);
}

async function targetEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

export async function listStaffAccounts(): Promise<StaffAccount[]> {
  await requireOwner();
  const admin = createAdminClient();
  const [{ data: profiles }, { data: users }] = await Promise.all([
    admin.from("profiles").select("id, full_name, role, is_active").order("created_at"),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);
  const emailById = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  return (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailById.get(p.id) ?? "",
    role: p.role,
    is_active: p.is_active,
    isSuperAdmin: (emailById.get(p.id) ?? "").toLowerCase() === SUPER_ADMIN_EMAIL,
  }));
}

export async function createStaffAccount(input: {
  fullName: string;
  email: string;
  role: "owner" | "staff";
  password?: string;
}): Promise<Result<{ password: string }>> {
  const { profile } = await requireOwner();

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (!fullName) return { ok: false, error: "Full name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  if (input.role !== "owner" && input.role !== "staff")
    return { ok: false, error: "Invalid role." };
  const password = input.password?.trim() || generatePassword();
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  const admin = createAdminClient();
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // shows the "change your temporary password" banner until they set their own
    user_metadata: { temp_password: true },
  });
  if (userErr) {
    return {
      ok: false,
      error: userErr.message.includes("already")
        ? "An account with that email already exists."
        : userErr.message,
    };
  }

  const { error: profErr } = await admin.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    role: input.role,
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: profErr.message };
  }

  await auditLog({
    actorId: profile.id,
    action: "staff.create",
    entity: "profiles",
    entityId: created.user.id,
    detail: { email, role: input.role },
  });
  revalidatePath("/settings");
  return { ok: true, value: { password } };
}

export async function updateStaffAccount(
  targetId: string,
  input: { fullName: string; role: "owner" | "staff"; isActive: boolean }
): Promise<Result> {
  const { profile, user } = await requireOwner();
  const email = await targetEmail(targetId);
  if (email === null) return { ok: false, error: "Account not found." };

  const isSuper = email.toLowerCase() === SUPER_ADMIN_EMAIL;
  if (isSuper && (input.role !== "owner" || !input.isActive)) {
    return { ok: false, error: "The super admin account cannot be demoted or deactivated." };
  }
  if (targetId === user.id && (!input.isActive || input.role !== "owner")) {
    return { ok: false, error: "You cannot deactivate or demote your own account." };
  }
  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "Full name is required." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName, role: input.role, is_active: input.isActive })
    .eq("id", targetId);
  if (error) return { ok: false, error: error.message };

  await auditLog({
    actorId: profile.id,
    action: "staff.update",
    entity: "profiles",
    entityId: targetId,
    detail: { role: input.role, isActive: input.isActive },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function resetStaffPassword(
  targetId: string
): Promise<Result<{ password: string }>> {
  const { profile, user } = await requireOwner();
  const email = await targetEmail(targetId);
  if (email === null) return { ok: false, error: "Account not found." };

  if (email.toLowerCase() === SUPER_ADMIN_EMAIL && user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) {
    return { ok: false, error: "Only the super admin can reset their own password." };
  }

  const password = generatePassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(targetId, {
    password,
    user_metadata: { temp_password: true },
  });
  if (error) return { ok: false, error: error.message };

  await auditLog({
    actorId: profile.id,
    action: "staff.reset_password",
    entity: "profiles",
    entityId: targetId,
  });
  return { ok: true, value: { password } };
}

export async function deleteStaffAccount(targetId: string): Promise<Result> {
  const { profile, user } = await requireOwner();
  const email = await targetEmail(targetId);
  if (email === null) return { ok: false, error: "Account not found." };

  if (email.toLowerCase() === SUPER_ADMIN_EMAIL) {
    return { ok: false, error: "The super admin account cannot be deleted." };
  }
  if (targetId === user.id) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  const admin = createAdminClient();
  const { error: profErr } = await admin.from("profiles").delete().eq("id", targetId);
  if (profErr) {
    if (profErr.code === "23503") {
      return {
        ok: false,
        error:
          "This account has recorded loans or payments and cannot be deleted. Deactivate it instead to block sign-in while keeping the records.",
      };
    }
    return { ok: false, error: profErr.message };
  }
  const { error: authErr } = await admin.auth.admin.deleteUser(targetId);
  if (authErr) return { ok: false, error: authErr.message };

  await auditLog({
    actorId: profile.id,
    action: "staff.delete",
    entity: "profiles",
    entityId: targetId,
    detail: { email },
  });
  revalidatePath("/settings");
  return { ok: true };
}
