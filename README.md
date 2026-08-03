# RIA Lending App

Loan management for Philippine lending companies. Built with **Next.js (App Router)**, **Supabase** (Postgres + Auth + RLS), and deployed on **Vercel**.

## Features

- **🧮 Public loan calculator** — supports the common Philippine interest schemes:
  - Monthly flat / add-on ("5-6" style)
  - Diminishing balance (bank-style amortization)
  - One-time fixed interest (borrow ₱10,000, repay ₱12,000)
  - Flat rate per payment (daily/weekly *hulugan*)
  - Frequencies: daily, weekly, semi-monthly (*kinsenas/katapusan*), monthly
  - Optional processing fee deducted from release
- **📄 Loan Agreement PDF** — auto-filled printable promissory note with terms in words and figures, full payment schedule, and signature blocks
- **📊 Loan monitoring** — staff dashboard of who is due today / overdue, payment recording with automatic allocation (penalties first, then oldest dues), late-payment penalties via daily cron, collections history, audit log
- **👤 Borrower portal** — debtors log in with **mobile number + access code** (no email needed) to view their outstanding balance, upcoming dues, and payment history

All money is handled as **integer centavos** (no floating-point drift), and all due dates are **Manila calendar dates**.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend + API | Next.js 16 (App Router, TypeScript, Tailwind) |
| Database | Supabase Postgres with Row Level Security |
| Staff auth | Supabase Auth (email/password) |
| Debtor auth | Phone + bcrypt access code → signed JWT cookie |
| PDF | @react-pdf/renderer (Node runtime) |
| Tests | Vitest (interest engine, dates, allocation) |
| Hosting | Vercel (with daily penalty cron) |

## Getting started

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (Singapore region is closest to PH).
2. In the SQL editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. In **Authentication → Sign In / Up**, disable public signups (staff accounts are created by the owner).
4. Create the owner's user in **Authentication → Users** (email + password), then insert their profile:
   ```sql
   insert into profiles (id, full_name, role)
   values ('<auth-user-uuid>', 'Owner Name', 'owner');
   ```
5. Copy the project URL, anon key, and service-role key from **Settings → API** into `.env.local`, and generate the two secrets:
   ```bash
   openssl rand -base64 32   # DEBTOR_SESSION_SECRET
   openssl rand -base64 32   # CRON_SECRET
   ```

### 3. Run

```bash
npm run dev    # http://localhost:3000
npm test       # interest engine + allocation test suite
```

## Deploying to Vercel

1. Push this repo to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. Add the five environment variables from `.env.example` in **Project → Settings → Environment Variables**.
3. `vercel.json` already schedules the penalty cron daily at **01:00 Manila** (`0 17 * * *` UTC). Vercel calls it with `Authorization: Bearer $CRON_SECRET`.
4. Every push to `main` auto-deploys.

## Architecture notes

- `lib/interest/` — the pure interest engine, shared by the calculator, loan creation, and the PDF, so they can never disagree. The last schedule row absorbs rounding so totals always reconcile to the centavo.
- `supabase/migrations/0001_init.sql` — schema, RLS policies, and transactional SQL functions (`create_loan_with_schedule`, `apply_payment`, `void_payment`).
- Schedules are **precomputed** at loan creation (`schedule_items`) — that's the ledger collectors work against.
- The debtor portal never touches Supabase Auth: staff issue a 6-digit access code (bcrypt-hashed, 5 attempts → 15-min lockout), and portal pages query via the service role **only through `lib/data/debtor-queries.ts`**, always scoped to the borrower id from the verified JWT.

## Security checklist (before going live)

- [ ] RLS probe: with only the anon key, REST queries on `borrowers`, `loans`, `borrower_access` must return zero rows.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` never appears in the client bundle (`grep -r service_role .next/static`).
- [ ] Access-code lockout works (5 wrong codes → locked 15 minutes).
- [ ] Cron endpoint rejects requests without the `CRON_SECRET` bearer token.
