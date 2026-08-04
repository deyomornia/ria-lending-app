-- 0003: four-tier roles
-- super_admin (system developer) > owner > manager > collector
-- The legacy 'staff' value stays in the enum (Postgres cannot drop enum
-- values) but is no longer assigned; existing staff become collectors.

-- NOTE for Supabase SQL editor: run this statement block FIRST, by itself —
-- new enum values must be committed before they can be used.
alter type user_role add value if not exists 'super_admin';
alter type user_role add value if not exists 'manager';
alter type user_role add value if not exists 'collector';
