"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/staff";
import { auditLog } from "@/lib/audit";

export async function updateCompanySettings(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireOwner();

  const { error } = await supabase
    .from("company_settings")
    .update({
      company_name: String(formData.get("company_name") ?? "").trim() || "RIA Lending",
      address: String(formData.get("address") ?? "").trim() || null,
      contact_number: String(formData.get("contact_number") ?? "").trim() || null,
      tin: String(formData.get("tin") ?? "").trim() || null,
      representative_name: String(formData.get("representative_name") ?? "").trim() || null,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);

  await auditLog({ actorId: profile.id, action: "settings.update", entity: "company_settings" });
  revalidatePath("/settings");
}
