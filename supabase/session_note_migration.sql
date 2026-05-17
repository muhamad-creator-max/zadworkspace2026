-- Add next-session note to sessions
-- Run this in Supabase SQL editor.

alter table sessions
  add column if not exists next_session_note text;
