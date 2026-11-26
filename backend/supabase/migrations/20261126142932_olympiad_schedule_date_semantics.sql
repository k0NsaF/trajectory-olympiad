ALTER TABLE public.olympiad_schedule_items
  ADD COLUMN IF NOT EXISTS date_semantics text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS start_time time without time zone,
  ADD COLUMN IF NOT EXISTS end_time time without time zone,
  ADD COLUMN IF NOT EXISTS time_zone text;

ALTER TABLE public.olympiad_schedule_items
  DROP CONSTRAINT IF EXISTS olympiad_schedule_items_date_semantics_check;

ALTER TABLE public.olympiad_schedule_items
  ADD CONSTRAINT olympiad_schedule_items_date_semantics_check
  CHECK (date_semantics = ANY (ARRAY['event','period','deadline','mixed','unknown']));

COMMENT ON COLUMN public.olympiad_schedule_items.date_semantics IS
  'Meaning of the source date: event, period, deadline, mixed (multiple/conflicting dates), or unknown. Only event/period/deadline may become calendar entries.';
COMMENT ON COLUMN public.olympiad_schedule_items.start_time IS
  'Start time extracted only when unambiguous; original wording remains in when_text.';
COMMENT ON COLUMN public.olympiad_schedule_items.end_time IS
  'End/cutoff time extracted only when unambiguous; original wording remains in when_text.';
COMMENT ON COLUMN public.olympiad_schedule_items.time_zone IS
  'IANA time zone resolved only from an explicit source clue. NULL means the source did not specify a reliable zone.';
