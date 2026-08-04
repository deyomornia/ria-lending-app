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
const UI_TEST_EMAIL = "zz-ui-test@example.com";

let staffUserId, collectorUserId, borrowerId, loanId, loan2Id, loan3Id, paymentId;
const COLLECTOR_EMAIL = "zz-smoke-collector@example.com";
const COLLECTOR_PW = "Collect-" + Math.random().toString(36).slice(2) + "-7z!";

async function cleanup() {
  try {
    for (const lid of [loanId, loan2Id, loan3Id]) {
      if (!lid) continue;
      const { data: pays } = await admin.from("payments").select("id").eq("loan_id", lid);
      for (const p of pays ?? []) {
        await admin.from("payment_allocations").delete().eq("payment_id", p.id);
      }
      await admin.from("payments").delete().eq("loan_id", lid);
      await admin.from("penalties").delete().eq("loan_id", lid);
      await admin.from("schedule_items").delete().eq("loan_id", lid);
      await admin.from("loans").delete().eq("id", lid);
    }
    if (borrowerId) {
      await admin.from("borrower_access").delete().eq("borrower_id", borrowerId);
      await admin.from("borrowers").delete().eq("id", borrowerId);
    }
    if (staffUserId) {
      await admin.from("remittances").delete().eq("collector_id", staffUserId);
      await admin.from("profiles").delete().eq("id", staffUserId);
      await admin.auth.admin.deleteUser(staffUserId);
    }
    if (collectorUserId) {
      await admin.from("profiles").delete().eq("id", collectorUserId);
      await admin.auth.admin.deleteUser(collectorUserId);
    }
    // in case the UI-created account survived a mid-test failure
    const { data: leftovers } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of leftovers?.users ?? []) {
      if (u.email === UI_TEST_EMAIL) {
        await admin.from("profiles").delete().eq("id", u.id);
        await admin.auth.admin.deleteUser(u.id);
      }
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
  await admin.from("profiles").insert({ id: staffUserId, full_name: "ZZ Smoke Test", role: "owner" });

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

  const { data: receiptRow } = await admin
    .from("payments").select("receipt_no").eq("id", paymentId).single();
  ok("payment gets a chronological receipt number (OR-YYYY-NNNNN)",
    /^OR-\d{4}-\d{5}$/.test(receiptRow?.receipt_no ?? ""), receiptRow?.receipt_no);

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
  try {
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    ok("staff login → dashboard", true);
  } catch {
    const err = await page.textContent("body").catch(() => "");
    throw new Error(
      "staff login did not reach dashboard (possible Supabase auth rate limit — wait a few minutes and rerun). Page said: " +
        err.slice(0, 200)
    );
  }
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

  // ---------- D1b. loans list page ----------
  await page.goto(BASE + "/loans");
  await page.waitForSelector("text=Every loan on record", { timeout: 15000 });
  const loansBody = await page.textContent("body");
  const { data: testLoan } = await admin.from("loans").select("loan_number").eq("id", loanId).single();
  ok("loans list shows the test loan with borrower and balance",
    loansBody.includes(testLoan.loan_number) &&
    loansBody.includes("ZZ TEST Borrower") &&
    loansBody.includes("₱11,000.00"));

  // ---------- D1c. loan approval workflow: propose -> approve -> release ----------
  const { data: loan2 } = await admin.rpc("create_loan_with_schedule", {
    p_initial_status: "pending_approval",
    p_borrower_id: borrowerId, p_interest_method: "one_time_fixed",
    p_principal_centavos: 500000, p_interest_rate_bps: null,
    p_fixed_interest_centavos: 50000, p_payment_frequency: "monthly",
    p_term_periods: 1, p_processing_fee_centavos: 0,
    p_release_date: "2026-08-04", p_first_due_date: "2026-09-04",
    p_total_interest_centavos: 50000, p_total_payable_centavos: 550000,
    p_penalty_rate_bps: 500, p_penalty_grace_days: 3, p_created_by: staffUserId,
    p_schedule: [{ seq: 1, due_date: "2026-09-04", principal_due: 500000, interest_due: 50000, total_due: 550000 }],
  });
  loan2Id = loan2;
  ok("create pending_approval proposal via RPC", !!loan2Id);

  await page.goto(BASE + "/dashboard");
  await page.waitForSelector("text=workflow queue", { timeout: 15000 });
  ok("dashboard shows workflow queue with pending proposal",
    (await page.textContent("body")).includes("needs approval"));

  await page.goto(`${BASE}/loans/${loan2Id}`);
  await page.getByRole("button", { name: "Approve" }).click();
  await page.waitForSelector("text=awaiting cash release", { timeout: 15000 });
  ok("manager approves proposal via UI", true);

  const releaseBtn = page.getByRole("button", { name: /Release cash/ });
  await releaseBtn.click();
  await page.getByRole("button", { name: /Confirm — cash handed over/ }).click();
  await page.waitForSelector("text=Record payment", { timeout: 20000 });
  const { data: releasedLoan } = await admin
    .from("loans")
    .select("status, release_date, first_due_date, released_by")
    .eq("id", loan2Id)
    .single();
  const todayManila = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  ok("release activates loan, stamps releaser, re-anchors schedule to today",
    releasedLoan.status === "active" &&
    releasedLoan.release_date === todayManila &&
    releasedLoan.released_by === staffUserId &&
    releasedLoan.first_due_date > todayManila,
    `status=${releasedLoan.status} release=${releasedLoan.release_date} firstDue=${releasedLoan.first_due_date}`);

  // ---------- D1d. payment integrity: signature for cash, ref for e-payments ----------
  await page.goto(`${BASE}/loans/${loanId}`);
  await page.waitForSelector("text=Record payment", { timeout: 15000 });
  await page.fill('input[type="number"]', "1");
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.waitForSelector("text=require the payor's signature", { timeout: 15000 });
  ok("cash payment without signature is rejected", true);

  // draw a signature on the canvas
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 60);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(box.x + 30 + i * 25, box.y + 60 + Math.sin(i) * 30, { steps: 3 });
  }
  await page.mouse.up();
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.waitForSelector("text=Payment recorded", { timeout: 20000 });
  const { data: sigPay } = await admin
    .from("payments")
    .select("id, signature_data")
    .eq("loan_id", loanId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  ok("cash payment with signature saves the signature image",
    sigPay?.signature_data?.startsWith("data:image/png;base64,"),
    `len=${sigPay?.signature_data?.length ?? 0}`);

  // ---------- D1d2. payment detail page: receipt, signature, edit, history ----------
  await page.goto(`${BASE}/payments/${sigPay.id}`);
  await page.waitForSelector("text=Receipt no.", { timeout: 15000 });
  const detailBody = await page.textContent("body");
  ok("payment detail shows receipt, signature, and history",
    /OR-\d{4}-\d{5}/.test(detailBody) &&
    detailBody.includes("Payor's signature") &&
    detailBody.includes("recorded this payment"));

  await page.getByRole("button", { name: "✏️ Edit details" }).click();
  const noteInputs = page.locator("div.rounded-xl.border-emerald-300 input");
  await noteInputs.last().fill("edited by smoke test");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForSelector("text=edited the payment details", { timeout: 20000 });
  const { data: editedPay } = await admin
    .from("payments").select("note").eq("id", sigPay.id).single();
  ok("manager edit saves details and appears in payment history",
    editedPay?.note === "edited by smoke test", editedPay?.note);

  // ---------- D1d3. audit log page (owner-only) ----------
  await page.goto(BASE + "/audit");
  await page.waitForSelector("text=Audit log", { timeout: 15000 });
  ok("audit log page lists actions with actors",
    (await page.textContent("body")).includes("edited a payment"));

  // sortable headers respond (loans by principal desc)
  await page.goto(BASE + "/loans?status=all&sort=principal&dir=desc");
  await page.waitForSelector("text=Every loan on record", { timeout: 15000 });
  ok("loans table sorts via clickable headers", (await page.textContent("body")).includes("▼"));

  await page.selectOption("select:below(:text('Method'))", "gcash").catch(() => {});
  const methodSelects = page.locator("select");
  // method select is the one containing a GCash option
  for (let i = 0; i < (await methodSelects.count()); i++) {
    const opts = await methodSelects.nth(i).locator("option").allTextContents();
    if (opts.some((o) => o.includes("GCash"))) { await methodSelects.nth(i).selectOption("gcash"); break; }
  }
  await page.fill('input[type="number"]', "1");
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.waitForSelector("text=require the reference number", { timeout: 15000 });
  ok("gcash payment without reference no. is rejected", true);

  // ---------- D1e. remittance: submit -> confirm ----------
  await page.goto(BASE + "/remittances");
  await page.waitForSelector("text=Submit remittance", { timeout: 15000 });
  await page.locator('input[type="number"]').last().fill("1.00");
  await page.getByRole("button", { name: "Submit remittance" }).click();
  await page.waitForSelector("text=Remittance submitted", { timeout: 15000 });
  ok("remittance submitted via UI", true);
  await page.getByRole("button", { name: "Confirm receipt" }).first().click();
  await page.getByRole("button", { name: "Cash received?" }).first().click();
  await page.waitForSelector("text=Confirmed ·", { timeout: 15000 });
  const { data: remitRow } = await admin
    .from("remittances")
    .select("status, confirmed_by")
    .eq("collector_id", staffUserId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single();
  ok("remittance confirmed by manager", remitRow?.status === "confirmed");

  // ---------- D1f. regression: a COLLECTOR can release an approved loan ----------
  const { data: colUser } = await admin.auth.admin.createUser({
    email: COLLECTOR_EMAIL, password: COLLECTOR_PW, email_confirm: true,
  });
  collectorUserId = colUser.user.id;
  await admin.from("profiles").insert({ id: collectorUserId, full_name: "ZZ Smoke Collector", role: "collector" });

  const { data: loan3 } = await admin.rpc("create_loan_with_schedule", {
    p_initial_status: "approved",
    p_borrower_id: borrowerId, p_interest_method: "one_time_fixed",
    p_principal_centavos: 200000, p_interest_rate_bps: null,
    p_fixed_interest_centavos: 20000, p_payment_frequency: "monthly",
    p_term_periods: 1, p_processing_fee_centavos: 0,
    p_release_date: "2026-08-04", p_first_due_date: "2026-09-04",
    p_total_interest_centavos: 20000, p_total_payable_centavos: 220000,
    p_penalty_rate_bps: 500, p_penalty_grace_days: 3, p_created_by: collectorUserId,
    p_schedule: [{ seq: 1, due_date: "2026-09-04", principal_due: 200000, interest_due: 20000, total_due: 220000 }],
  });
  loan3Id = loan3;

  const tokenRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: COLLECTOR_EMAIL, password: COLLECTOR_PW }),
  });
  const { access_token } = await tokenRes.json();
  const relRes = await fetch(`${SUPA_URL}/rest/v1/rpc/release_loan`, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_loan_id: loan3Id,
      p_released_by: collectorUserId,
      p_release_date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()),
      p_first_due_date: "2026-09-10",
      p_schedule: [{ seq: 1, due_date: "2026-09-10", principal_due: 200000, interest_due: 20000, total_due: 220000 }],
    }),
  });
  const relBody = await relRes.text();
  const { data: loan3After } = await admin.from("loans").select("status").eq("id", loan3Id).single();
  ok("collector can release an approved loan (RLS regression)",
    (relRes.status === 200 || relRes.status === 204) && loan3After?.status === "active",
    `http=${relRes.status} status=${loan3After?.status} ${relBody.slice(0, 80)}`);

  // ---------- D2. staff account management (Settings, owner-only) ----------
  await page.goto(BASE + "/settings");
  await page.waitForSelector("text=Staff accounts", { timeout: 15000 });
  const superRow = page.locator("tbody tr", { hasText: "Super admin" });
  ok("settings lists accounts with Super admin badge", (await superRow.count()) === 1);
  ok("super admin row has no Edit/Delete buttons",
    (await superRow.getByRole("button", { name: "Delete" }).count()) === 0 &&
    (await superRow.getByRole("button", { name: "Edit" }).count()) === 0);

  await page.getByRole("button", { name: "+ Add account" }).click();
  const addPanel = page.locator("div.bg-slate-50");
  await addPanel.locator("input").nth(0).fill("ZZ UI Test Account");
  await addPanel.locator('input[type="email"]').fill(UI_TEST_EMAIL);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForSelector(`text=${UI_TEST_EMAIL}`, { timeout: 15000 });
  ok("add account via UI creates it (temp password revealed)",
    (await page.textContent("body")).includes("Temporary password"));

  const uiRow = page.locator("tbody tr", { hasText: "ZZ UI Test Account" });
  await uiRow.getByRole("button", { name: "Delete" }).click();
  await uiRow.getByRole("button", { name: "Confirm delete?" }).click();
  let uiRowGone = true;
  try {
    await uiRow.waitFor({ state: "detached", timeout: 20000 });
  } catch {
    uiRowGone = false;
  }
  ok("delete account via UI removes it", uiRowGone);

  // ---------- D3. self-service password change ----------
  const NEW_PW = TEST_STAFF_PW + "-changed";
  await page.goto(BASE + "/account/password");
  await page.waitForSelector("text=Current password", { timeout: 15000 });
  await page.fill('input[autocomplete="current-password"]', "wrong-password-123");
  const pwInputs = page.locator('input[autocomplete="new-password"]');
  await pwInputs.nth(0).fill(NEW_PW);
  await pwInputs.nth(1).fill(NEW_PW);
  await page.getByRole("button", { name: "Change password" }).click();
  await page.waitForSelector("text=Current password is incorrect", { timeout: 15000 });
  ok("password change rejects wrong current password", true);

  await page.fill('input[autocomplete="current-password"]', TEST_STAFF_PW);
  await pwInputs.nth(0).fill(NEW_PW);
  await pwInputs.nth(1).fill(NEW_PW);
  await page.getByRole("button", { name: "Change password" }).click();
  await page.waitForSelector("text=Password changed", { timeout: 15000 });
  ok("password change succeeds with correct current password", true);

  // sign out, then sign back in with the NEW password
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await page.waitForURL("**/login", { timeout: 15000 });
  await page.fill('input[type="email"]', TEST_STAFF_EMAIL);
  await page.fill('input[type="password"]', NEW_PW);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 30000 });
  ok("sign in works with the new password", true);

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
