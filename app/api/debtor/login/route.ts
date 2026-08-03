import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAccessCode } from "@/lib/auth/access-code";
import { createDebtorSession } from "@/lib/auth/debtor-session";
import { normalizePhPhone } from "@/lib/phone";
import { auditLog } from "@/lib/audit";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// Always the same message — never reveal whether the phone exists
const GENERIC_ERROR = { error: "Invalid mobile number or access code." };

export async function POST(request: NextRequest) {
  let body: { phone?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(GENERIC_ERROR, { status: 400 });
  }

  const phone = normalizePhPhone(String(body.phone ?? ""));
  const code = String(body.code ?? "").trim();
  if (!phone || !/^\d{6}$/.test(code)) {
    return NextResponse.json(GENERIC_ERROR, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: borrower } = await admin
    .from("borrowers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (!borrower) return NextResponse.json(GENERIC_ERROR, { status: 401 });

  const { data: access } = await admin
    .from("borrower_access")
    .select("access_code_hash, failed_attempts, locked_until")
    .eq("borrower_id", borrower.id)
    .maybeSingle();
  if (!access) return NextResponse.json(GENERIC_ERROR, { status: 401 });

  if (access.locked_until && new Date(access.locked_until) > new Date()) {
    return NextResponse.json(
      { error: "Too many failed attempts. Please try again in a few minutes." },
      { status: 429 }
    );
  }

  const valid = await verifyAccessCode(code, access.access_code_hash);
  if (!valid) {
    const attempts = access.failed_attempts + 1;
    await admin
      .from("borrower_access")
      .update({
        failed_attempts: attempts,
        locked_until:
          attempts >= MAX_ATTEMPTS
            ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
            : null,
      })
      .eq("borrower_id", borrower.id);
    return NextResponse.json(GENERIC_ERROR, { status: 401 });
  }

  await admin
    .from("borrower_access")
    .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq("borrower_id", borrower.id);

  await createDebtorSession(borrower.id);
  await auditLog({
    actorType: "debtor",
    action: "debtor.login",
    entity: "borrowers",
    entityId: borrower.id,
  });

  return NextResponse.json({ ok: true });
}
