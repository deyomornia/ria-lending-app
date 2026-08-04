"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireStaff } from "@/lib/auth/staff";
import { auditLog } from "@/lib/audit";
import { todayInManila } from "@/lib/tz";

export type RemitResult = { ok: true } | { ok: false; error: string };

/** A collector (or manager on their behalf) records cash turned over to the office. */
export async function submitRemittance(input: {
  collectorId: string;
  remitDate?: string;
  amountCentavos: number;
  note?: string;
}): Promise<RemitResult> {
  const { supabase, profile } = await requireStaff();

  if (!Number.isSafeInteger(input.amountCentavos) || input.amountCentavos <= 0) {
    return { ok: false, error: "Enter a valid remittance amount." };
  }
  const remitDate = input.remitDate ?? todayInManila();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(remitDate) || remitDate > todayInManila()) {
    return { ok: false, error: "Enter a valid remittance date (today or earlier)." };
  }

  const { data: collector } = await supabase
    .from("profiles")
    .select("id, is_active")
    .eq("id", input.collectorId)
    .single();
  if (!collector?.is_active) return { ok: false, error: "Collector not found or inactive." };

  const { data, error } = await supabase
    .from("remittances")
    .insert({
      collector_id: input.collectorId,
      remit_date: remitDate,
      amount_centavos: input.amountCentavos,
      note: input.note?.trim() || null,
      submitted_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await auditLog({
    actorId: profile.id,
    action: "remittance.submit",
    entity: "remittances",
    entityId: data.id,
    detail: { collectorId: input.collectorId, amount: input.amountCentavos, remitDate },
  });
  revalidatePath("/remittances");
  return { ok: true };
}

/** Manager+ confirms physically receiving the remitted cash. */
export async function confirmRemittance(remittanceId: string): Promise<RemitResult> {
  const { supabase, profile } = await requireManager();

  const { data, error } = await supabase
    .from("remittances")
    .update({
      status: "confirmed",
      confirmed_by: profile.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", remittanceId)
    .eq("status", "submitted")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "This remittance was already confirmed." };

  await auditLog({
    actorId: profile.id,
    action: "remittance.confirm",
    entity: "remittances",
    entityId: remittanceId,
  });
  revalidatePath("/remittances");
  return { ok: true };
}
