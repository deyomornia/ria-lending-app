import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function auditLog(entry: {
  actorId?: string | null;
  actorType?: "staff" | "system" | "debtor";
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    actor_id: entry.actorId ?? null,
    actor_type: entry.actorType ?? "staff",
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    detail: entry.detail ?? null,
  });
}
