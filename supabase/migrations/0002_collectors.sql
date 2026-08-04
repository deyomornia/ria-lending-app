-- 0002: collector assignment
-- Every loan can have an assigned collector; every payment records who
-- actually collected it (may differ from the staff member who encoded it).

alter table loans add column collector_id uuid references profiles(id);
alter table payments add column collector_id uuid references profiles(id);

create index loans_collector_idx on loans (collector_id);
create index payments_collector_idx on payments (collector_id);
