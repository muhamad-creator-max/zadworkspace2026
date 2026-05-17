-- Room-switch support: store per-segment time in each session.
-- Each segment: { room_id, room_name, started_at, ended_at, duration_minutes, price }
-- Run this in Supabase SQL editor.

alter table sessions
  add column if not exists session_segments jsonb not null default '[]'::jsonb;
