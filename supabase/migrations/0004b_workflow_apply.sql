-- 0004b: loan approval workflow (run AFTER 0004_workflow.sql has committed)
-- SOP: collector proposes → manager/owner approves (or rejects with reason)
-- → cash released (schedule re-anchored to the actual release date) → active.

alter table loans
  add column approved_by uuid references profiles(id),
  add column approved_at timestamptz,
  add column rejected_by uuid references profiles(id),
  add column rejected_at timestamptz,
  add column rejection_reason text,
  add column released_by uuid references profiles(id),
  add column released_at timestamptz;

-- create_loan_with_schedule gains an initial-status parameter:
-- collectors create 'pending_approval', managers/owners create 'approved'.
-- (Callers omitting it still get 'active' — kept for backward compatibility.)
drop function create_loan_with_schedule(uuid, interest_method, bigint, int, bigint, payment_frequency, int, bigint, date, date, bigint, bigint, int, int, uuid, jsonb);

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
  p_schedule jsonb,
  p_initial_status loan_status default 'active'
) returns uuid language plpgsql as $$
declare
  v_loan_id uuid;
  v_number text;
  v_sum_total bigint;
  v_sum_principal bigint;
begin
  if p_initial_status not in ('active','pending_approval','approved') then
    raise exception 'invalid initial status %', p_initial_status;
  end if;

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
    p_penalty_rate_bps, p_penalty_grace_days, p_initial_status, p_created_by
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

-- Atomic cash release: only an approved loan can be released; the payment
-- schedule is replaced with one anchored to the actual release date.
create function release_loan(
  p_loan_id uuid,
  p_released_by uuid,
  p_release_date date,
  p_first_due_date date,
  p_schedule jsonb
) returns void language plpgsql as $$
declare
  v_status loan_status;
  v_total bigint;
  v_sum bigint;
begin
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
