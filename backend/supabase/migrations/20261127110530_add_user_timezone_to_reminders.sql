alter table public.reminders
  add column if not exists time_zone text;

alter table public.reminders
  drop constraint if exists reminders_time_zone_check;

alter table public.reminders
  add constraint reminders_time_zone_check
  check (time_zone is null or time_zone ~ '^[A-Za-z_+-]+(/[A-Za-z0-9_+-]+)*$');

comment on column public.reminders.time_zone is 'IANA timezone reported by the browser when the reminder was created; used to format scheduled email notifications.';
