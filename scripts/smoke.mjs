/* Live smoke test for RIA Lending. Creates clearly-marked TEST data, exercises
 * every flow (routes, staff UI, loan+payment RPCs, PDF, debtor portal), then
 * deletes everything it created. */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const BASE = "https://rialending.dgtechsolutions.online";
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPA_URL, SK, { auth: { persistSession: false } });

const results = [];
const ok = (name, pass, detail = "") =>
  results.push({ name, pass, detail }) && console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);

const TEST_PHONE = "+639990000001";
const TEST_STAFF_EMAIL = "zz-smoke-test@example.com";
const TEST_STAFF_PW = "Smoke-" + Math.random().toString(36).slice(2) + "-9x!";
const ACCESS_CODE = "424242";

let staffUserId, borrowerId, loanId, paymentId;

async function cleanup() {
  try {
    if (loanId) {
      const { data: pays } = await admin.from("payments").select("id").eq("loan_id", loanId);
      for (const p of pays ?? []) {
        await admin.from("payment_allocations").delete().eq("payment_id", p.id);
      }
      await admin.from("payments").delete().eq("loan_id", loanId);
      await admin.from("penalties").delete().eq("loan_id", loanId);
      await admin.from("schedule_items").delete().eq("loan_id", loanId);
      await admin.from("loans").delete().eq("id", loanId);
    }
    if (borrowerId) {
      await admin.from("borrower_access").delete().eq("borrower_id", borrowerId);
      await admin.from("borrowers").delete().eq("id", borrowerId);
    }
    if (staffUserId) {
      await admin.from("profiles").delete().eq("id", staffUserId);
      await admin.auth.admin.deleteUser(staffUserId);
    }
    console.log("cleanup: done");
  } catch (e) {
    console.log("cleanup ERROR:", e.message);
  }
}

try {
  // ---------- A. public routes ----------
  for (const [path, want] of [
    ["/", 200],
    ["/calculator", 200],
    ["/login", 200],
    ["/portal/login", 200],
    ["/api/cron/penalties", 401],
  ]) {
    const r = await fetch(BASE + path, { redirect: "manual" });
    ok(`route ${path} → ${want}`, r.status === want, `got ${r.status}`);
  }
  {
    const r = await fetch(BASE + "/dashboard", { redirect: "manual" });
    ok("route /dashboard redirects to /login when signed out",
      r.status === 307 && (r.headers.get("location") || "").includes("/login"),
      `got ${r.status}`);
  }

  // ---------- B. setup test data (service role) ----------
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: TEST_STAFF_EMAIL,
    password: TEST_STAFF_PW,
    email_confirm: true,
  });
  if (userErr) throw new Error("create staff: " + userErr.message);
  staffUserId = created.user.id;
  await admin.from("profiles").insert({ id: staffUserId, full_name: "ZZ Smoke Test", role: "staff" });

  const { data: b, error: bErr } = await admin
    .from("borrowers")
    .insert({ full_name: "ZZ TEST Borrower (auto-delete)", phone: TEST_PHONE, created_by: staffUserId })
    .select("id").single();
  if (bErr) throw new Error("create borrower: " + bErr.message);
  borrowerId = b.id;

  // one_time_fixed: ₱10,000 + ₱1,000 interest, 2 monthly payments of ₱5,500
  const { data: loan, error: loanErr } = await admin.rpc("create_loan_with_schedule", {
    p_borrower_id: borrowerId,
    p_interest_method: "one_time_fixed",
    p_principal_centavos: 1000000,
    p_interest_rate_bps: null,
    p_fixed_interest_centavos: 100000,
    p_payment_frequency: "monthly",
    p_term_periods: 2,
    p_processing_fee_centavos: 0,
    p_release_date: "2026-08-04",
    p_first_due_date: "2026-09-04",
    p_total_interest_centavos: 100000,
    p_total_payable_centavos: 1100000,
    p_penalty_rate_bps: 500,
    p_penalty_grace_days: 3,
    p_created_by: staffUserId,
    p_schedule: [
      { seq: 1, due_date: "2026-09-04", principal_due: 500000, interest_due: 50000, total_due: 550000 },
      { seq: 2, due_date: "2026-10-04", principal_due: 500000, interest_due: 50000, total_due: 550000 },
    ],
  });
  ok("create_loan_with_schedule RPC", !loanErr && !!loan, loanErr?.message);
  loanId = loan;

  const bal0 = (await admin.from("loan_balances").select("*").eq("loan_id", loanId).single()).data;
  ok("initial outstanding = ₱11,000.00", bal0?.outstanding_centavos === 1100000,
    `got ${bal0?.outstanding_centavos}`);

  // reject bad schedule (sum mismatch)
  const { error: badErr } = await admin.rpc("create_loan_with_schedule", {
    p_borrower_id: borrowerId, p_interest_method: "one_time_fixed",
    p_principal_centavos: 1000000, p_interest_rate_bps: null,
    p_fixed_interest_centavos: 100000, p_payment_frequency: "monthly",
    p_term_periods: 1, p_processing_fee_centavos: 0,
    p_release_date: "2026-08-04", p_first_due_date: "2026-09-04",
    p_total_interest_centavos: 100000, p_total_payable_centavos: 1100000,
    p_penalty_rate_bps: 500, p_penalty_grace_days: 3, p_created_by: staffUserId,
    p_schedule: [{ seq: 1, due_date: "2026-09-04", principal_due: 1, interest_due: 1, total_due: 2 }],
  });
  ok("RPC rejects mismatched schedule totals", !!badErr, badErr?.message?.slice(0, 60));

  // ---------- C. payment round trip ----------
  const items = (await admin.from("schedule_items").select("*").eq("loan_id", loanId).order("seq")).data;
  const { data: payId, error: payErr } = await admin.rpc("apply_payment", {
    p_loan_id: loanId, p_amount_centavos: 550000, p_payment_date: "2026-08-04",
    p_method: "cash", p_reference_no: null, p_received_by: staffUserId, p_note: "smoke test",
    p_item_allocations: [{ id: items[0].id, amount: 550000 }],
    p_penalty_allocations: [],
  });
  ok("apply_payment RPC", !payErr && !!payId, payErr?.message);
  paymentId = payId;

  const item1 = (await admin.from("schedule_items").select("*").eq("id", items[0].id).single()).data;
  const bal1 = (await admin.from("loan_balances").select("*").eq("loan_id", loanId).single()).data;
  ok("first installment marked paid", item1?.status === "paid", item1?.status);
  ok("outstanding after payment = ₱5,500.00", bal1?.outstanding_centavos === 550000,
    `got ${bal1?.outstanding_centavos}`);

  const { error: overErr } = await admin.rpc("apply_payment", {
    p_loan_id: loanId, p_amount_centavos: 1, p_payment_date: "2026-08-04",
    p_method: "cash", p_reference_no: null, p_received_by: staffUserId, p_note: "overpay probe",
    p_item_allocations: [{ id: items[0].id, amount: 1 }], p_penalty_allocations: [],
  });
  ok("apply_payment rejects overpaying a settled row", !!overErr, overErr?.message?.slice(0, 50));

  const { error: voidErr } = await admin.rpc("void_payment", {
    p_payment_id: paymentId, p_voided_by: staffUserId, p_reason: "smoke test void",
  });
  const bal2 = (await admin.from("loan_balances").select("*").eq("loan_id", loanId).single()).data;
  const item1b = (await admin.from("schedule_items").select("*").eq("id", items[0].id).single()).data;
  ok("void_payment restores balance to ₱11,000.00",
    !voidErr && bal2?.outstanding_centavos === 1100000 && item1b?.status === "pending",
    voidErr?.message ?? `bal ${bal2?.outstanding_centavos}, item ${item1b?.status}`);

  // ---------- D. staff UI E2E (live site) ----------
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/login");
  await page.fill('input[type="email"]', TEST_STAFF_EMAIL);
  await page.fill('input[type="password"]', TEST_STAFF_PW);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  ok("staff login → dashboard", true);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "dashboard.png", fullPage: true });

  // regression: with the ₱11,000 test loan active, outstanding must not read ₱0.00
  const dashBody = await page.textContent("body");
  ok("dashboard outstanding total is not silently zero",
    !dashBody.includes("No outstanding balance") && !dashBody.match(/TOTAL OUTSTANDING\s*₱0\.00/i));

  await page.goto(`${BASE}/loans/${loanId}`);
  const loanBody = await page.textContent("body");
  ok("loan page shows test borrower + schedule",
    loanBody.includes("ZZ TEST Borrower") && loanBody.includes("₱11,000.00"));
  await page.screenshot({ path: "loan.png", fullPage: true });

  const pdfResp = await page.request.get(`${BASE}/api/loans/${loanId}/agreement`);
  const pdfBuf = await pdfResp.body();
  ok("agreement PDF renders (authenticated)",
    pdfResp.status() === 200 && pdfBuf.slice(0, 5).toString() === "%PDF-",
    `status ${pdfResp.status()}, ${pdfBuf.length} bytes`);

  // ---------- E. debtor portal E2E ----------
  await admin.from("borrower_access").insert({
    borrower_id: borrowerId,
    access_code_hash: await bcrypt.hash(ACCESS_CODE, 10),
  });

  const pctx = await browser.newContext();
  const badLogin = await pctx.request.post(BASE + "/api/debtor/login", {
    data: { phone: "09990000001", code: "111111" },
  });
  ok("portal rejects wrong code with generic 401", badLogin.status() === 401);

  const goodLogin = await pctx.request.post(BASE + "/api/debtor/login", {
    data: { phone: "0999 000 0001", code: ACCESS_CODE },
  });
  ok("portal login with phone + code", goodLogin.status() === 200);

  const portalPage = await pctx.newPage();
  await portalPage.goto(BASE + "/portal");
  const portalBody = await portalPage.textContent("body");
  ok("portal shows balance for the right borrower",
    portalBody.includes("ZZ TEST Borrower") && portalBody.includes("₱11,000.00"));
  await portalPage.screenshot({ path: "portal.png", fullPage: true });

  // lockout after repeated failures
  let lockStatus = 0;
  for (let i = 0; i < 6; i++) {
    const r = await pctx.request.post(BASE + "/api/debtor/login", {
      data: { phone: "09990000001", code: "000000" },
    });
    lockStatus = r.status();
  }
  ok("lockout after 5 wrong codes (429)", lockStatus === 429, `got ${lockStatus}`);

  await browser.close();
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await cleanup();
}

const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
process.exit(fails.length ? 1 : 0);
