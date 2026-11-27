ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences SET DEFAULT
    '{"registrationReminders": true, "stageDeadlines": true, "newsUpdates": false, "personalReminders": false}'::jsonb;

UPDATE public.profiles
SET notification_preferences = jsonb_set(
  COALESCE(notification_preferences, '{}'::jsonb),
  '{personalReminders}',
  CASE
    WHEN jsonb_typeof(notification_preferences -> 'personalReminders') = 'boolean'
      THEN notification_preferences -> 'personalReminders'
    ELSE 'false'::jsonb
  END,
  true
)
WHERE jsonb_typeof(notification_preferences -> 'personalReminders') IS DISTINCT FROM 'boolean';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_notification_preferences_valid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_notification_preferences_valid
    CHECK (
      jsonb_typeof(notification_preferences) = 'object'
      AND jsonb_typeof(notification_preferences -> 'registrationReminders') = 'boolean'
      AND jsonb_typeof(notification_preferences -> 'stageDeadlines') = 'boolean'
      AND jsonb_typeof(notification_preferences -> 'newsUpdates') = 'boolean'
      AND jsonb_typeof(notification_preferences -> 'personalReminders') = 'boolean'
    );

COMMENT ON COLUMN public.profiles.notification_preferences IS
  'Notification delivery preferences. personalReminders controls emails for user-created reminders and defaults to false.';
