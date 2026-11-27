-- Restrict the public read-only olympiad catalogue to SELECT only.
-- Earlier CREATE TABLE statements inherited broad default grants.

REVOKE ALL PRIVILEGES ON TABLE
  public.olympiad_profiles,
  public.olympiad_schedule_items
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.olympiad_profiles,
  public.olympiad_schedule_items
TO anon, authenticated;

-- Future objects created by the postgres migration role must be exposed
-- explicitly with GRANT statements in the migration that creates them.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;