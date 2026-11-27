BEGIN;

-- These helper functions are only used by existing table triggers.
-- Do not expose them as callable functions to public API roles.
REVOKE EXECUTE ON FUNCTION public.set_updated_at()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.set_university_registry_updated_at()
  FROM PUBLIC, anon, authenticated;

COMMIT;