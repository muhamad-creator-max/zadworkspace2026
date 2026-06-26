-- ============ ATTENDANCE: BANK IN / BANK OUT ============
-- Adds the money amount the staff started the shift with (bank_in) and the
-- amount left before checking out (bank_out).
-- Run this after attendance_schema.sql.

alter table attendance
  add column if not exists bank_in numeric(12, 2),
  add column if not exists bank_out numeric(12, 2);
