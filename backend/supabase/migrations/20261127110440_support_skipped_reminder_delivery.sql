alter table public.reminders
  drop constraint if exists reminders_notification_status_check;

alter table public.reminders
  add constraint reminders_notification_status_check
  check (notification_status = any(array['pending','processing','sent','failed','skipped']));

comment on column public.reminders.notification_status is 'Server-side email delivery state: pending, processing, sent, failed or skipped by user notification preferences.';
