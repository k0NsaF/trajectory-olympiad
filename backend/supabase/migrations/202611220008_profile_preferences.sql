alter table public.profiles
  add column theme_preference text not null default 'system',
  add column notification_preferences jsonb not null default
    '{"registrationReminders": true, "stageDeadlines": true, "newsUpdates": false}'::jsonb;

alter table public.profiles
  add constraint profiles_theme_preference_valid
    check (theme_preference in ('light', 'dark', 'system')),
  add constraint profiles_notification_preferences_valid
    check (
      jsonb_typeof(notification_preferences) = 'object'
      and jsonb_typeof(notification_preferences -> 'registrationReminders') = 'boolean'
      and jsonb_typeof(notification_preferences -> 'stageDeadlines') = 'boolean'
      and jsonb_typeof(notification_preferences -> 'newsUpdates') = 'boolean'
    );
