ALTER TABLE public.olympiad_schedule_items
  ALTER COLUMN checked_on DROP NOT NULL;

ALTER TABLE public.olympiad_schedule_items
  DROP CONSTRAINT olympiad_schedule_items_organizer_url_check;

ALTER TABLE public.olympiad_schedule_items
  ADD CONSTRAINT olympiad_schedule_items_organizer_url_check
  CHECK (organizer_url ~ '^https?://[^[:space:]]+$');
