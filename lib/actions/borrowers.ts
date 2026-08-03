"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAccessCode, hashAccessCode } from "@/lib/auth/access-code";
import { auditLog } from "@/lib/audit";
import { normalizePhPhone } from "@/lib/phone";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createBorrower(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireStaff();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = normalizePhPhone(String(formData.get("phone") ?? ""));
  if (!fullName) throw new Error("Name is required");
  if (!phone) throw new Error("Enter a valid PH mobile number (e.g. 0917 123 4567)");

  const { data, error } = await supabase
    .from("borrowers")
    .insert({
      full_name: fullName,
      phone,
      address: String(formData.get("address") ?? "").trim() || null,
      id_type: String(formData.get("id_type") ?? "").trim() || null,
      id_number: String(formData.get("id_number") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      error.code === "23505" ? "A borrower with that phone number already exists." : error.message
    );
  }

  await auditLog({
    actorId: profile.id,
    action: "borrower.create",
    entity: "borrowers",
    entityId: data.id,
    detail: { fullName, phone },
  });

  revalidatePath("/borrowers");
  redirect(`/borrowers/${data.id}`);
}

export async function updateBorrower(borrowerId: string, formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await requireStaff();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = normalizePhPhone(String(formData.get("phone") ?? ""));
  if (!fullName) return { ok: false, error: "Name is required" };
  if (!phone) return { ok: false, error: "Enter a valid PH mobile number" };

  const { error } = await supabase
    .from("borrowers")
    .update({
      full_name: fullName,
      phone,
      address: String(formData.get("address") ?? "").trim() || null,
      id_type: String(formData.get("id_type") ?? "").trim() || null,
      id_number: String(formData.get("id_number") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", borrowerId);

  if (error) return { ok: false, error: error.message };

  await auditLog({
    actorId: profile.id,
    action: "borrower.update",
    entity: "borrowers",
    entityId: borrowerId,
  });

  revalidatePath(`/borrowers/${borrowerId}`);
  return { ok: true };
}

/**
 * Issues (or rotates) a debtor-portal access code. Returns the plaintext code
 * ONCE for the staff member to relay to the borrower; only the hash is stored.
 */
export async function issueAccessCode(
  borrowerId: string
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const { supabase, profile } = await requireStaff();

  // RLS-checked read proves the caller may manage this borrower
  const { data: borrower } = await supabase
    .from("borrowers")
    .select("id")
    .eq("id", borrowerId)
    .single();
  if (!borrower) return { ok: false, error: "Borrower not found" };

  const code = generateAccessCode();
  const admin = createAdminClient();
  const { error } = await admin.from("borrower_access").upsert({
    borrower_id: borrowerId,
    access_code_hash: await hashAccessCode(code),
    failed_attempts: 0,
    locked_until: null,
    code_issued_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  await auditLog({
    actorId: profile.id,
    action: "access_code.issue",
    entity: "borrower_access",
    entityId: borrowerId,
  });

  return { ok: true, code };
}
