-- 0006: official receipt numbers, richer apply_payment, tighter payment edits
-- Single run.

-- ============================================================
-- Receipt numbers: unique + chronological (OR-YYYY-NNNNN)
-- ============================================================
create sequence receipt_no_seq;

alter table payments add column receipt_no text unique;

-- Backfill existing payments in chronological order
with ordered as (
  select id, paid_at, row_number() over (order by paid_at) as rn
  from payments
)
update payments p
   set receipt_no = 'OR-' || to_char(o.paid_at at time zone 'Asia/Manila', 'YYYY')
                 || '-' || lpad(o.rn::text, 5, '0')
  from ordered o
 where o.id = p.id;

select setval('receipt_no_seq', greatest((select count(*) from payments), 1));

-- ============================================================
-- apply_payment v2: stamps the receipt number and records collector +
-- signature atomically (previously written in a follow-up update).
-- ============================================================
drop function apply_payment(uuid, bigint, date, text, text, uuid, text, jsonb, jsonb);

create function apply_payment(
  p_loan_id uuid,
  p_amount_centavos bigint,
  p_payment_date date,
  p_method text,
  p_reference_no text,
  p_received_by uuid,
  p_note text,
  p_item_allocations jsonb,
  p_penalty_allocations jsonb,
  p_collector_id uuid default null,
  p_signature_data text default null
) returns uuid language plpgsql as $$
declare
  v_payment_id uuid;
  v_alloc_sum bigint;
  v_receipt text;
  r record;
begin
  select coalesce((select sum((a->>'amount')::bigint) from jsonb_array_elements(p_item_allocations) a), 0)
       + coalesce((select sum((a->>'amount')::bigint) from jsonb_array_elements(p_penalty_allocations) a), 0)
    into v_alloc_sum;
  if v_alloc_sum <> p_amount_centavos then
    raise exception 'allocations sum % does not match payment amount %', v_alloc_sum, p_amount_centavos;
  end if;

  v_receipt := 'OR-' || to_char(p_payment_date, 'YYYY')
            || '-' || lpad(nextval('receipt_no_seq')::text, 5, '0');

  insert into payments (loan_id, amount_centavos, payment_date, method, reference_no,
                        received_by, note, collector_id, signature_data, receipt_no)
  values (p_loan_id, p_amount_centavos, p_payment_date, p_method, p_reference_no,
          p_received_by, p_note, p_collector_id, p_signature_data, v_receipt)
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

-- ============================================================
-- Payments may now only be UPDATED by managers/owners (detail edits).
-- Creation goes through apply_payment (insert policy unchanged);
-- collectors no longer need direct update access.
-- ============================================================
drop policy payments_update on payments;
create policy payments_update on payments for update using (is_manager_up());
