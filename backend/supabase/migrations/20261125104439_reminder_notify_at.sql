-- Stores a preferred notification time for future push / MAX integration.
-- This migration only adds storage; it does not send notifications.
alter table public.reminders
  add column if not exists notify_at timestamptz null;

create index if not exists reminders_notify_at_pending_idx
  on public.reminders (notify_at)
  where notify_at is not null and status = 'pending';
