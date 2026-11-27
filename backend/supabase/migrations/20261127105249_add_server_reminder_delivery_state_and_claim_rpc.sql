ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS notification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notification_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_provider_id text,
  ADD COLUMN IF NOT EXISTS notification_last_error text;

ALTER TABLE public.reminders
  DROP CONSTRAINT IF EXISTS reminders_notification_status_check;

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_notification_status_check
  CHECK (notification_status = ANY(ARRAY['pending','processing','sent','failed']));

ALTER TABLE public.reminders
  DROP CONSTRAINT IF EXISTS reminders_notification_attempts_check;

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_notification_attempts_check
  CHECK (notification_attempts >= 0);

CREATE INDEX IF NOT EXISTS reminders_due_delivery_idx
  ON public.reminders (notify_at, notification_next_attempt_at)
  WHERE notify_at IS NOT NULL
    AND status = 'pending'
    AND notification_sent_at IS NULL
    AND notification_status IN ('pending','processing');

CREATE OR REPLACE FUNCTION public.claim_due_reminders(p_limit integer DEFAULT 50)
RETURNS SETOF public.reminders
LANGUAGE sql
SET search_path = public
AS $$
  WITH due AS (
    SELECT r.id
    FROM public.reminders r
    WHERE r.notify_at IS NOT NULL
      AND r.notify_at <= now()
      AND r.status = 'pending'
      AND r.notification_sent_at IS NULL
      AND (
        r.notification_status = 'pending'
        OR (
          r.notification_status = 'processing'
          AND r.notification_claimed_at < now() - interval '15 minutes'
        )
      )
      AND (
        r.notification_next_attempt_at IS NULL
        OR r.notification_next_attempt_at <= now()
      )
    ORDER BY r.notify_at ASC, r.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  )
  UPDATE public.reminders r
  SET notification_status = 'processing',
      notification_claimed_at = now(),
      updated_at = now()
  FROM due
  WHERE r.id = due.id
  RETURNING r.*;
$$;

REVOKE ALL ON FUNCTION public.claim_due_reminders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_reminders(integer) TO service_role;

COMMENT ON COLUMN public.reminders.notification_status IS 'Server-side delivery state; independent of user task completion status.';
COMMENT ON COLUMN public.reminders.notification_attempts IS 'Number of delivery attempts made by the server scheduler.';
COMMENT ON COLUMN public.reminders.notification_sent_at IS 'Timestamp when the reminder email provider confirmed acceptance.';
COMMENT ON FUNCTION public.claim_due_reminders(integer) IS 'Atomically claims due reminders with SKIP LOCKED so concurrent cron runs do not double-claim rows.';
