-- 0003b: apply the new roles (run AFTER 0003_roles.sql has committed)

-- The system developer account becomes the protected super_admin
update profiles set role = 'super_admin'
where id in (select id from auth.users where lower(email) = 'deodexter95@gmail.com');

-- Legacy staff accounts become collectors
update profiles set role = 'collector' where role = 'staff';

-- RLS helpers: owner-level now includes super_admin;
-- manager-level = manager and above.
create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from profiles
     where id = auth.uid() and is_active and role in ('owner','super_admin')
   ) $$;

create function is_manager_up() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from profiles
     where id = auth.uid() and is_active and role in ('manager','owner','super_admin')
   ) $$;
