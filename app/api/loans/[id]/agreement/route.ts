import { createElement, type ReactElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { AgreementDocument } from "@/lib/pdf/AgreementDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Staff session required; RLS enforces access on every query below
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: loan }, { data: company }] = await Promise.all([
    supabase.from("loans").select("*, borrowers(*)").eq("id", id).single(),
    supabase.from("company_settings").select("*").eq("id", 1).single(),
  ]);
  if (!loan || !company) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: rows } = await supabase
    .from("schedule_items")
    .select("seq, due_date, total_due_centavos")
    .eq("loan_id", id)
    .order("seq");

  const pdf = await renderToBuffer(
    createElement(AgreementDocument, {
      company,
      borrower: loan.borrowers,
      loan,
      rows: rows ?? [],
    }) as unknown as ReactElement<DocumentProps>
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${loan.loan_number}-agreement.pdf"`,
    },
  });
}
