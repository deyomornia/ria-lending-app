import { NextResponse } from "next/server";
import { clearDebtorSession } from "@/lib/auth/debtor-session";

export const runtime = "nodejs";

export async function POST() {
  await clearDebtorSession();
  return NextResponse.json({ ok: true });
}
