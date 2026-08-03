import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, diffDays } from "@/lib/interest/dates";
import { applyBps } from "@/lib/interest/money";
import { todayInManila } from "@/lib/tz";
import { auditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Days per payment period, used to space repeat penalty assessments. */
const PERIOD_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  semi_monthly: 15,
  monthly: 30,
};

/**
 * Daily sweep (Vercel Cron, 01:00 Manila): assess a penalty on every open
 * schedule item past its grace period — once when it first crosses grace,
 * then once per further full payment-period unpaid. Deterministic assessment
 * dates + the (schedule_item_id, assessed_on) unique constraint make re-runs
 * idempotent.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = todayInManila();

  const { data: items, error } = await admin
    .from("schedule_items")
    .select(
      "id, due_date, total_due_centavos, loans!inner(id, status, payment_frequency, penalty_rate_bps, penalty_grace_days)"
    )
    .in("status", ["pending", "partial"])
    .lt("due_date", today)
    .eq("loans.status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let assessed = 0;
  for (const item of items ?? []) {
    const loan = item.loans as unknown as {
      id: string;
      payment_frequency: string;
      penalty_rate_bps: number;
      penalty_grace_days: number;
    };
    if (loan.penalty_rate_bps <= 0) continue;

    const periodDays = PERIOD_DAYS[loan.payment_frequency] ?? 30;
    const firstAssessDate = addDays(item.due_date, loan.penalty_grace_days + 1);
    const daysSinceFirst = diffDays(firstAssessDate, today);
    if (daysSinceFirst < 0) continue; // still within grace

    const count = 1 + Math.floor(daysSinceFirst / periodDays);
    const amount = applyBps(item.total_due_centavos, loan.penalty_rate_bps);

    const rows = Array.from({ length: count }, (_, k) => ({
      loan_id: loan.id,
      schedule_item_id: item.id,
      amount_centavos: amount,
      assessed_on: addDays(firstAssessDate, k * periodDays),
      reason: "late_payment",
    }));

    const { data: inserted, error: insErr } = await admin
      .from("penalties")
      .upsert(rows, { onConflict: "schedule_item_id,assessed_on", ignoreDuplicates: true })
      .select("id");
    if (insErr) {
      return NextResponse.json({ error: insErr.message, itemId: item.id }, { status: 500 });
    }
    assessed += inserted?.length ?? 0;
  }

  if (assessed > 0) {
    await auditLog({
      actorType: "system",
      action: "penalty.assess",
      entity: "penalties",
      detail: { assessed, date: today },
    });
  }

  return NextResponse.json({ ok: true, date: today, itemsChecked: items?.length ?? 0, assessed });
}
