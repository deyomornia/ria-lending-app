-- RIA Lending App — initial schema
-- All money columns are bigint centavos. All due dates are `date` (Manila
-- calendar dates); only event timestamps are timestamptz.

-- ============================================================ enums

create type user_role as enum ('owner','staff');
create type interest_method as enum ('flat_addon','diminishing','one_time_fixed','per_period_flat');
create type payment_frequency as enum ('daily','weekly','semi_monthly','monthly');
create type loan_status as enum ('draft','active','paid','defaulted','cancelled','restructured');
create type schedule_status as enum ('pending','partial','paid','waived');
create type penalty_type as enum ('fixed','percent_of_installment');

-- ============================================================ tables

-- Staff/owner profile, 1:1 with auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table borrowers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,            -- normalized +639XXXXXXXXX
  address text,
  id_type text,
  id_number text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Debtor portal credentials. Deny-all RLS: service-role access only.
create table borrower_access (
  borrower_id uuid primary key references borrowers(id) on delete cascade,
  access_code_hash text not null,        -- bcrypt of 6-digit code
  failed_attempts int not null default 0,
  locked_until timestamptz,
  code_issued_at timestamptz not null default now(),
  last_login_at timestamptz
);

create sequence loan_number_seq;

create table loans (
  id uuid primary key default gen_random_uuid(),
  loan_number text not null unique,
  borrower_id uuid not null references borrowers(id),
  interest_method interest_method not null,
  principal_centavos bigint not null check (principal_centavos > 0),
  interest_rate_bps int,                 -- per month (flat_addon) or per period; null for one_time_fixed
  fixed_interest_centavos bigint,        -- one_time_fixed only
  payment_frequency payment_frequency not null,
  term_periods int not null check (term_periods > 0),
  processing_fee_centavos bigint not null default 0,
  release_date date not null,
  first_due_date date not null,
  total_interest_centavos bigint not null,
  total_payable_centavos bigint not null,
  penalty_type penalty_type not null default 'percent_of_installment',
  penalty_rate_bps int not null default 500,
  penalty_grace_days int not null default 3,
  status loan_status not null default 'draft',
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on loans (borrower_id);
create index on loans (status);

create table schedule_items (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  seq int not null,
  due_date date not null,
  principal_due_centavos bigint not null,
  interest_due_centavos bigint not null,
  total_due_centavos bigint not null,
  paid_centavos bigint not null default 0,
  status schedule_status not null default 'pending',
  unique (loan_id, seq)
);
create index schedule_items_open_due_idx
  on schedule_items (due_date) where status in ('pending','partial');

create table penalties (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id),
  schedule_item_id uuid not null references schedule_items(id),
  amount_centavos bigint not null,
  assessed_on date not null,
  reason text not null default 'late_payment',
  paid_centavos bigint not null default 0,
  waived_at timestamptz,
  waived_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (schedule_item_id, assessed_on)  -- keeps the daily cron idempotent
);
create index on penalties (loan_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id),
  amount_centavos bigint not null check (amount_centavos > 0),
  paid_at timestamptz not null default now(),
  payment_date date not null,            -- Manila date shown on the receipt
  method text not null default 'cash',   -- cash | gcash | bank
  reference_no text,
  received_by uuid not null references profiles(id),
  note text,
  voided_at timestamptz,
  voided_by uuid references profiles(id),
  void_reason text,
  created_at timestamptz not null default now()
);
create index on payments (loan_id);

-- How each payment was split across schedule rows / penalties
create table payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  schedule_item_id uuid references schedule_items(id),
  penalty_id uuid references penalties(id),
  amount_centavos bigint not null check (amount_centavos > 0),
  check ((schedule_item_id is null) <> (penalty_id is null))
);
create index on payment_allocations (payment_id);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_type text not null default 'staff',   -- staff | system | debtor
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- Single-row company info used on the agreement PDF header
create table company_settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'RIA Lending',
  address text,
  contact_number text,
  tin text,
  representative_name text,
  updated_at timestamptz not null default now()
);
insert into company_settings (id) values (1);

-- ============================================================ updated_at triggers

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger borrowers_updated_at before update on borrowers
  for each row execute function set_updated_at();
create trigger loans_updated_at before update on loans
  for each row execute function set_updated_at();
create trigger company_settings_updated_at before update on company_settings
  for each row execute function set_updated_at();

-- ============================================================ balance view

create view loan_balances with (security_invoker = on) as
select
  l.id as loan_id,
  l.borrower_id,
  l.total_payable_centavos
    + coalesce(pen.assessed, 0)
    - coalesce(pay.paid, 0) as outstanding_centavos,
  coalesce(pen.assessed, 0) as penalties_centavos,
  coalesce(pay.paid, 0) as paid_centavos
from loans l
left join lateral (
  select sum(amount_centavos) as assessed
  from penalties p
  where p.loan_id = l.id and p.waived_at is null
) pen on true
left join lateral (
  select sum(amount_centavos) as paid
  from payments p
  where p.loan_id = l.id and p.voided_at is null
) pay on true;

-- ============================================================ transactional loan creation

-- Inserts the loan and its precomputed schedule atomically. Called from
-- server actions (service role). Schedule rows come from the TS interest
-- engine; totals are verified here as a backstop.
create function create_loan_with_schedule(
  p_borrower_id uuid,
  p_interest_method interest_method,
  p_principal_centavos bigint,
  p_interest_rate_bps int,
  p_fixed_interest_centavos bigint,
  p_payment_frequency payment_frequency,
  p_term_periods int,
  p_processing_fee_centavos bigint,
  p_release_date date,
  p_first_due_date date,
  p_total_interest_centavos bigint,
  p_total_payable_centavos bigint,
  p_penalty_rate_bps int,
  p_penalty_grace_days int,
  p_created_by uuid,
  p_schedule jsonb   -- [{seq, due_date, principal_due, interest_due, total_due}]
) returns uuid language plpgsql as $$
declare
  v_loan_id uuid;
  v_number text;
  v_sum_total bigint;
  v_sum_principal bigint;
begin
  select coalesce(sum((r->>'total_due')::bigint), 0),
         coalesce(sum((r->>'principal_due')::bigint), 0)
    into v_sum_total, v_sum_principal
    from jsonb_array_elements(p_schedule) r;

  if v_sum_total <> p_total_payable_centavos then
    raise exception 'schedule total % does not match total_payable %', v_sum_total, p_total_payable_centavos;
  end if;
  if v_sum_principal <> p_principal_centavos then
    raise exception 'schedule principal % does not match principal %', v_sum_principal, p_principal_centavos;
  end if;
  if jsonb_array_length(p_schedule) <> p_term_periods then
    raise exception 'schedule has % rows, expected %', jsonb_array_length(p_schedule), p_term_periods;
  end if;

  v_number := 'RIA-' || to_char(now() at time zone 'Asia/Manila', 'YYYY')
              || '-' || lpad(nextval('loan_number_seq')::text, 4, '0');

  insert into loans (
    loan_number, borrower_id, interest_method, principal_centavos,
    interest_rate_bps, fixed_interest_centavos, payment_frequency, term_periods,
    processing_fee_centavos, release_date, first_due_date,
    total_interest_centavos, total_payable_centavos,
    penalty_rate_bps, penalty_grace_days, status, created_by
  ) values (
    v_number, p_borrower_id, p_interest_method, p_principal_centavos,
    p_interest_rate_bps, p_fixed_interest_centavos, p_payment_frequency, p_term_periods,
    p_processing_fee_centavos, p_release_date, p_first_due_date,
    p_total_interest_centavos, p_total_payable_centavos,
    p_penalty_rate_bps, p_penalty_grace_days, 'active', p_created_by
  ) returning id into v_loan_id;

  insert into schedule_items (loan_id, seq, due_date, principal_due_centavos, interest_due_centavos, total_due_centavos)
  select v_loan_id,
         (r->>'seq')::int,
         (r->>'due_date')::date,
         (r->>'principal_due')::bigint,
         (r->>'interest_due')::bigint,
         (r->>'total_due')::bigint
    from jsonb_array_elements(p_schedule) r;

  return v_loan_id;
end $$;

-- ============================================================ atomic payment application

-- Allocations are computed in TypeScript (lib/allocation.ts) and applied here
-- atomically: insert payment + allocations, bump paid amounts/statuses, and
-- settle the loan when everything is paid.
create function apply_payment(
  p_loan_id uuid,
  p_amount_centavos bigint,
  p_payment_date date,
  p_method text,
  p_reference_no text,
  p_received_by uuid,
  p_note text,
  p_item_allocations jsonb,     -- [{id, amount}]
  p_penalty_allocations jsonb   -- [{id, amount}]
) returns uuid language plpgsql as $$
declare
  v_payment_id uuid;
  v_alloc_sum bigint;
  r record;
begin
  select coalesce((select sum((a->>'amount')::bigint) from jsonb_array_elements(p_item_allocations) a), 0)
       + coalesce((select sum((a->>'amount')::bigint) from jsonb_array_elements(p_penalty_allocations) a), 0)
    into v_alloc_sum;
  if v_alloc_sum <> p_amount_centavos then
    raise exception 'allocations sum % does not match payment amount %', v_alloc_sum, p_amount_centavos;
  end if;

  insert into payments (loan_id, amount_centavos, payment_date, method, reference_no, received_by, note)
  values (p_loan_id, p_amount_centavos, p_payment_date, p_method, p_reference_no, p_received_by, p_note)
  returning id into v_payment_id;

  for r in select (a->>'id')::uuid as id, (a->>'amount')::bigint as amount
             from jsonb_array_elements(p_penalty_allocations) a
  loop
    insert into payment_allocations (payment_id, penalty_id, amount_centavos)
    values (v_payment_id, r.id, r.amount);
    update penalties set paid_centavos = paid_centavos + r.amount
    where id = r.id and loan_id = p_loan_id and paid_centavos + r.amount <= amount_centavos;
    if not found then
      raise exception 'penalty % overpaid or not part of loan', r.id;
    end if;
  end loop;

  for r in select (a->>'id')::uuid as id, (a->>'amount')::bigint as amount
             from jsonb_array_elements(p_item_allocations) a
  loop
    insert into payment_allocations (payment_id, schedule_item_id, amount_centavos)
    values (v_payment_id, r.id, r.amount);
    update schedule_items
       set paid_centavos = paid_centavos + r.amount,
           status = case when paid_centavos + r.amount >= total_due_centavos then 'paid'::schedule_status
                         else 'partial'::schedule_status end
    where id = r.id and loan_id = p_loan_id and paid_centavos + r.amount <= total_due_centavos;
    if not found then
      raise exception 'schedule item % overpaid or not part of loan', r.id;
    end if;
  end loop;

  -- settle the loan if nothing remains
  if not exists (
       select 1 from schedule_items
       where loan_id = p_loan_id and status in ('pending','partial')
     )
     and not exists (
       select 1 from penalties
       where loan_id = p_loan_id and waived_at is null and paid_centavos < amount_centavos
     )
  then
    update loans set status = 'paid' where id = p_loan_id and status = 'active';
  end if;

  return v_payment_id;
end $$;

-- Reverses a payment's allocations atomically and reopens the loan if needed.
create function void_payment(
  p_payment_id uuid,
  p_voided_by uuid,
  p_reason text
) returns void language plpgsql as $$
declare
  v_loan_id uuid;
  r record;
begin
  select loan_id into v_loan_id from payments
  where id = p_payment_id and voided_at is null for update;
  if v_loan_id is null then
    raise exception 'payment not found or already voided';
  end if;

  for r in select schedule_item_id, penalty_id, amount_centavos
             from payment_allocations where payment_id = p_payment_id
  loop
    if r.schedule_item_id is not null then
      update schedule_items
         set paid_centavos = paid_centavos - r.amount_centavos,
             status = case when paid_centavos - r.amount_centavos <= 0 then 'pending'::schedule_status
                           else 'partial'::schedule_status end
      where id = r.schedule_item_id;
    else
      update penalties set paid_centavos = paid_centavos - r.amount_centavos
      where id = r.penalty_id;
    end if;
  end loop;

  update payments
     set voided_at = now(), voided_by = p_voided_by, void_reason = p_reason
   where id = p_payment_id;

  update loans set status = 'active' where id = v_loan_id and status = 'paid';
end $$;

-- ============================================================ RLS

alter table profiles enable row level security;
alter table borrowers enable row level security;
alter table borrower_access enable row level security;   -- no policies: service-role only
alter table loans enable row level security;
alter table schedule_items enable row level security;
alter table penalties enable row level security;
alter table payments enable row level security;
alter table payment_allocations enable row level security;
alter table audit_log enable row level security;         -- no policies: service-role only
alter table company_settings enable row level security;

-- security definer avoids RLS recursion when policies read profiles
create function is_active_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and is_active) $$;

create function is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and is_active and role = 'owner') $$;

-- profiles: staff can read all (to display names); only owner mutates
create policy profiles_select on profiles for select using (is_active_staff() or id = auth.uid());
create policy profiles_update on profiles for update using (is_owner());

-- operational tables: active staff read/write; owner-only delete
create policy borrowers_select on borrowers for select using (is_active_staff());
create policy borrowers_insert on borrowers for insert with check (is_active_staff());
create policy borrowers_update on borrowers for update using (is_active_staff());
create policy borrowers_delete on borrowers for delete using (is_owner());

create policy loans_select on loans for select using (is_active_staff());
create policy loans_insert on loans for insert with check (is_active_staff());
create policy loans_update on loans for update using (is_active_staff());
create policy loans_delete on loans for delete using (is_owner());

create policy schedule_select on schedule_items for select using (is_active_staff());
create policy schedule_insert on schedule_items for insert with check (is_active_staff());
create policy schedule_update on schedule_items for update using (is_active_staff());
create policy schedule_delete on schedule_items for delete using (is_owner());

create policy penalties_select on penalties for select using (is_active_staff());
create policy penalties_insert on penalties for insert with check (is_active_staff());
create policy penalties_update on penalties for update using (is_active_staff());
create policy penalties_delete on penalties for delete using (is_owner());

create policy payments_select on payments for select using (is_active_staff());
create policy payments_insert on payments for insert with check (is_active_staff());
create policy payments_update on payments for update using (is_active_staff());
create policy payments_delete on payments for delete using (is_owner());

create policy allocations_select on payment_allocations for select using (is_active_staff());
create policy allocations_insert on payment_allocations for insert with check (is_active_staff());
create policy allocations_delete on payment_allocations for delete using (is_owner());

create policy company_select on company_settings for select using (is_active_staff());
create policy company_update on company_settings for update using (is_owner());
