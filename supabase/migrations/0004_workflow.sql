-- 0004: loan approval workflow — enum values
-- Run this block FIRST, by itself (new enum values must commit before use).

alter type loan_status add value if not exists 'pending_approval';
alter type loan_status add value if not exists 'approved';
alter type loan_status add value if not exists 'rejected';
