-- 0005: release_loan RLS fix, payment signatures, remittances
-- Single run — no enum changes.

-- ============================================================
-- FIX: release_loan failed for managers/collectors with
-- "duplicate key value violates unique constraint" because RLS blocked the
-- schedule delete for non-owners. Run with definer rights + own staff check.
-- ============================================================
create or replace function release_loan(
  p_loan_id uuid,
  p_released_by uuid,
  p_release_date date,
  p_first_due_date date,
  p_schedule jsonb
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_status loan_status;
  v_total bigint;
  v_sum bigint;
begin
  -- definer rights bypass RLS, so verify the caller ourselves
  if auth.uid() is null
     or not exists (select 1 from profiles where id = auth.uid() and is_active)
     or p_released_by <> auth.uid() then
    raise exception 'not authorized';
  end if;

  select status, total_payable_centavos into v_status, v_total
  from loans where id = p_loan_id for update;

  if v_status is null then
    raise exception 'loan not found';
  end if;
  if v_status <> 'approved' then
    raise exception 'loan is %, only approved loans can be released', v_status;
  end if;

  select coalesce(sum((r->>'total_due')::bigint), 0)
    into v_sum from jsonb_array_elements(p_schedule) r;
  if v_sum <> v_total then
    raise exception 'new schedule total % does not match total_payable %', v_sum, v_total;
  end if;

  delete from schedule_items where loan_id = p_loan_id;

  insert into schedule_items (loan_id, seq, due_date, principal_due_centavos, interest_due_centavos, total_due_centavos)
  select p_loan_id,
         (r->>'seq')::int,
         (r->>'due_date')::date,
         (r->>'principal_due')::bigint,
         (r->>'interest_due')::bigint,
         (r->>'total_due')::bigint
    from jsonb_array_elements(p_schedule) r;

  update loans
     set status = 'active',
         release_date = p_release_date,
         first_due_date = p_first_due_date,
         released_by = p_released_by,
         released_at = now()
   where id = p_loan_id;
end $$;

-- ============================================================
-- Payment integrity: payor's digital signature for cash collections
-- (stored as a data-URL PNG; reference_no is enforced app-side for
-- gcash/bank payments)
-- ============================================================
alter table payments add column signature_data text;

-- ============================================================
-- Remittances: collector turns over collected cash; manager/owner confirms
-- ============================================================
create table remittances (
  id uuid primary key default gen_random_uuid(),
  collector_id uuid not null references profiles(id),
  remit_date date not null,               -- Manila date the cash covers
  amount_centavos bigint not null check (amount_centavos > 0),
  note text,
  status text not null default 'submitted' check (status in ('submitted','confirmed')),
  submitted_by uuid not null references profiles(id),
  submitted_at timestamptz not null default now(),
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on remittances (collector_id, remit_date);
create index on remittances (status);

alter table remittances enable row level security;
create policy remit_select on remittances for select using (is_active_staff());
create policy remit_insert on remittances for insert with check (is_active_staff());
create policy remit_update on remittances for update using (is_manager_up());
create policy remit_delete on remittances for delete using (is_owner());
