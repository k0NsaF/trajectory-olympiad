-- Run after applying the trajectory_generation_api migration to STAGING.
-- These queries are read-only and verify the intended least-privilege model.

-- User-owned rows remain readable through RLS. Planning tables are read-only to
-- authenticated clients; profile clients may update only theme/notification columns.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', format('public.%I', c.relname), 'SELECT') as anon_can_select,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'SELECT') as authenticated_can_select,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'UPDATE') as authenticated_can_update,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'DELETE') as authenticated_can_delete,
  has_table_privilege('service_role', format('public.%I', c.relname), 'INSERT') as service_role_can_insert
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profile_subject_preparation',
    'profile_alternative_universities',
    'trajectory_plans',
    'trajectory_stages',
    'trajectory_tasks'
  )
order by c.relname;

-- All write RPCs are invoker-rights and callable only by the backend service role.
-- Authenticated browser clients must not be able to execute any of these functions.
select
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'save_profile_bundle',
    'save_profile_planning_preferences',
    'create_trajectory_plan',
    'update_trajectory_task_status'
  )
order by p.proname;

-- New columns and uniqueness/index support.
select
  table_name,
  column_name,
  is_nullable,
  data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'trajectory_plans' and column_name = 'generation_request_id')
    or (table_name = 'trajectory_stages' and column_name = 'stable_key')
    or (table_name = 'trajectory_tasks' and column_name in ('stable_key', 'weekly_minutes'))
  )
order by table_name, column_name;

select
  indexname,
  indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and tablename = 'trajectory_plans'
  and indexname in (
    'trajectory_plans_generation_request_unique_idx',
    'trajectory_plans_user_created_at_idx'
  )
order by indexname;

-- Write RPCs must be invoker-rights, unavailable to browser roles, and callable
-- by the server-only service role. Both trajectory status-changing RPCs must
-- serialize against the same profile row lock.
select
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  pg_catalog.strpos(pg_catalog.upper(pg_catalog.pg_get_functiondef(p.oid)), 'FOR UPDATE') > 0 as serializes_on_profile_row
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('save_profile_bundle', 'create_trajectory_plan', 'update_trajectory_task_status')
order by p.proname;

-- Service role requires DML privileges to execute these invoker-rights RPCs.
select
  table_name,
  has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE') as authenticated_table_update,
  has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE') as authenticated_can_delete,
  has_table_privilege('service_role', format('public.%I', table_name), 'SELECT') as service_can_select,
  has_table_privilege('service_role', format('public.%I', table_name), 'INSERT') as service_can_insert,
  has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE') as service_can_update,
  has_table_privilege('service_role', format('public.%I', table_name), 'DELETE') as service_can_delete
from (values
  ('profiles'),
  ('programs'),
  ('profile_subject_preparation'),
  ('profile_alternative_universities'),
  ('trajectory_plans'),
  ('trajectory_stages'),
  ('trajectory_tasks')
) as required(table_name)
order by table_name;


-- Only these two profile columns remain updateable through the authenticated Data API.
select
  has_column_privilege('authenticated', 'public.profiles', 'theme_preference', 'UPDATE') as can_update_theme,
  has_column_privilege('authenticated', 'public.profiles', 'notification_preferences', 'UPDATE') as can_update_notifications,
  has_column_privilege('authenticated', 'public.profiles', 'grade', 'UPDATE') as can_update_grade,
  has_column_privilege('authenticated', 'public.profiles', 'subjects', 'UPDATE') as can_update_subjects,
  has_column_privilege('authenticated', 'public.profiles', 'weekly_study_hours', 'UPDATE') as can_update_weekly_study_hours;


-- Authenticated INSERT is disabled; UPDATE is restricted to the two UI preference columns.
select
  column_name,
  privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and grantee = 'authenticated'
  and privilege_type in ('INSERT', 'UPDATE')
order by privilege_type, column_name;

-- The profile bundle RPC is backend-only and uses invoker privileges.
select
  p.proname as function_name,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  pg_catalog.strpos(pg_catalog.upper(pg_catalog.pg_get_functiondef(p.oid)), 'FOR UPDATE') > 0 as serializes_profile_write
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'save_profile_bundle';

-- The database-side generation quota must remain in the SQL function.
select
  pg_catalog.strpos(pg_catalog.pg_get_functiondef(p.oid), '15 minutes') > 0 as has_fifteen_minute_limit,
  pg_catalog.strpos(pg_catalog.pg_get_functiondef(p.oid), '24 hours') > 0 as has_rolling_daily_limit,
  pg_catalog.strpos(pg_catalog.upper(pg_catalog.pg_get_functiondef(p.oid)), 'FOR UPDATE') > 0 as serializes_generation
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_trajectory_plan';


-- Profiles must be readable by authenticated users only (RLS still restricts rows).
select
  has_table_privilege('anon', 'public.profiles', 'SELECT') as anon_can_select_profiles,
  has_table_privilege('authenticated', 'public.profiles', 'SELECT') as authenticated_can_select_profiles,
  has_table_privilege('authenticated', 'public.profiles', 'INSERT') as authenticated_can_insert_profiles,
  has_table_privilege('authenticated', 'public.profiles', 'DELETE') as authenticated_can_delete_profiles;
