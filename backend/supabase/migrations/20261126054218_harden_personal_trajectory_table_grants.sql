-- Restrict table privileges for personal trajectory data.
-- RLS stays enabled; anon receives no table-level permissions.
-- Authenticated users get only the CRUD permissions needed by the API.

REVOKE ALL PRIVILEGES ON TABLE
  public.profile_subject_preparation,
  public.profile_alternative_universities,
  public.trajectory_plans,
  public.trajectory_stages,
  public.trajectory_tasks
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profile_subject_preparation,
  public.profile_alternative_universities,
  public.trajectory_plans,
  public.trajectory_stages,
  public.trajectory_tasks
TO authenticated, service_role;
