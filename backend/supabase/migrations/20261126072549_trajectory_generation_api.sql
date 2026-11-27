-- Trajectory V2: deterministic plan generation and progress persistence.
-- This is an additive migration for the existing personal-trajectory foundation.

-- Save the public profile and its planning preferences as one transaction.
-- This is an invoker-rights RPC executable only by the backend service role.
-- Express verifies the end-user JWT and supplies that verified user's id.
create or replace function public.save_profile_bundle(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_profile jsonb,
  p_preferences jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := p_user_id;
  v_email text := nullif(trim(p_email), '');
  v_full_name text := nullif(trim(p_full_name), '');
  v_grade integer;
  v_region text;
  v_subjects text[];
  v_target_university_id uuid;
  v_target_program_id uuid;
begin
  if v_user_id is null then
    raise exception 'Verified user id is required.' using errcode = '22023';
  end if;
  if v_email is not null and length(v_email) > 320 then
    raise exception 'Email is too long.' using errcode = '22023';
  end if;
  if v_full_name is not null and length(v_full_name) > 160 then
    raise exception 'Full name is too long.' using errcode = '22023';
  end if;

  if p_profile is null or jsonb_typeof(p_profile) is distinct from 'object' then
    raise exception 'Profile must be a JSON object.' using errcode = '22023';
  end if;
  if p_preferences is null or jsonb_typeof(p_preferences) is distinct from 'object' then
    raise exception 'Planning preferences must be a JSON object.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_object_keys(p_profile) as item(key)
     where item.key not in (
       'grade', 'region', 'subjects', 'targetUniversityId', 'targetProgramId'
     )
  ) then
    raise exception 'Unknown profile field.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_object_keys(p_preferences) as item(key)
     where item.key not in (
       'weeklyStudyHours', 'targetAdmissionYear', 'targetEducationLevel',
       'subjectPreparation', 'alternativeUniversityIds'
     )
  ) then
    raise exception 'Unknown planning preference.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_profile -> 'grade') is distinct from 'number'
     or (p_profile ->> 'grade') !~ '^(7|8|9|10|11)$' then
    raise exception 'Grade must be an integer from 7 to 11.' using errcode = '22023';
  end if;
  v_grade := (p_profile ->> 'grade')::integer;

  if jsonb_typeof(p_profile -> 'region') is distinct from 'string' then
    raise exception 'Region is required.' using errcode = '22023';
  end if;
  v_region := nullif(trim(p_profile ->> 'region'), '');
  if v_region is null or length(v_region) < 2 or length(v_region) > 120 then
    raise exception 'Region must contain 2 to 120 characters.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_profile -> 'subjects') is distinct from 'array' then
    raise exception 'Subjects must be a JSON array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_profile -> 'subjects') < 1
     or jsonb_array_length(p_profile -> 'subjects') > 10 then
    raise exception 'Choose between one and ten subjects.' using errcode = '22023';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_profile -> 'subjects') as item(value)
     where jsonb_typeof(item.value) is distinct from 'string'
        or item.value #>> '{}' not in (
          'mathematics', 'informatics', 'physics', 'biology', 'chemistry',
          'economics', 'russian', 'history', 'social_studies', 'foreign_language'
        )
  ) then
    raise exception 'Unknown subject in profile.' using errcode = '22023';
  end if;
  if exists (
    select item.value #>> '{}'
      from jsonb_array_elements(p_profile -> 'subjects') as item(value)
     group by item.value #>> '{}'
    having count(*) > 1
  ) then
    raise exception 'Profile subjects must be unique.' using errcode = '22023';
  end if;
  select array_agg(item.value #>> '{}' order by item.ordinality)
    into v_subjects
    from jsonb_array_elements(p_profile -> 'subjects') with ordinality as item(value, ordinality);

  if p_profile ? 'targetUniversityId'
     and coalesce(jsonb_typeof(p_profile -> 'targetUniversityId'), 'null') not in ('string', 'null') then
    raise exception 'Primary university id must be a UUID or null.' using errcode = '22023';
  end if;
  if p_profile ? 'targetProgramId'
     and coalesce(jsonb_typeof(p_profile -> 'targetProgramId'), 'null') not in ('string', 'null') then
    raise exception 'Target program id must be a UUID or null.' using errcode = '22023';
  end if;
  if nullif(p_profile ->> 'targetUniversityId', '') is not null then
    if (p_profile ->> 'targetUniversityId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Primary university id must be a UUID.' using errcode = '22023';
    end if;
    v_target_university_id := (p_profile ->> 'targetUniversityId')::uuid;
  end if;
  if nullif(p_profile ->> 'targetProgramId', '') is not null then
    if (p_profile ->> 'targetProgramId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Target program id must be a UUID.' using errcode = '22023';
    end if;
    v_target_program_id := (p_profile ->> 'targetProgramId')::uuid;
  end if;
  if v_target_program_id is not null and v_target_university_id is null then
    raise exception 'A target program requires a primary university.' using errcode = '22023';
  end if;
  if v_target_program_id is not null and not exists (
    select 1
      from public.programs as program
     where program.id = v_target_program_id
       and program.university_id = v_target_university_id
  ) then
    raise exception 'The selected program does not belong to the primary university.' using errcode = '23503';
  end if;

  -- Validate all optional values before changing any row.
  if p_preferences ? 'weeklyStudyHours' then
    if jsonb_typeof(p_preferences -> 'weeklyStudyHours') is distinct from 'number'
       or (p_preferences ->> 'weeklyStudyHours') !~ '^[0-9]+$'
       or length(p_preferences ->> 'weeklyStudyHours') > 2 then
      raise exception 'Weekly study hours must be a whole JSON number.' using errcode = '22023';
    end if;
    if (p_preferences ->> 'weeklyStudyHours')::integer not between 1 and 40 then
      raise exception 'Weekly study hours must be an integer from 1 to 40.' using errcode = '22023';
    end if;
  end if;
  if p_preferences ? 'targetAdmissionYear' then
    if jsonb_typeof(p_preferences -> 'targetAdmissionYear') is distinct from 'number'
       or (p_preferences ->> 'targetAdmissionYear') !~ '^[0-9]+$'
       or length(p_preferences ->> 'targetAdmissionYear') > 4 then
      raise exception 'Target admission year must be a whole JSON number.' using errcode = '22023';
    end if;
    if (p_preferences ->> 'targetAdmissionYear')::integer not between 2026 and 2100 then
      raise exception 'Target admission year must be an integer from 2026 to 2100.' using errcode = '22023';
    end if;
  end if;
  if p_preferences ? 'targetEducationLevel' and (
    jsonb_typeof(p_preferences -> 'targetEducationLevel') is distinct from 'string'
    or (p_preferences ->> 'targetEducationLevel') not in ('bachelor', 'specialist', 'master')
  ) then
    raise exception 'Unsupported target education level.' using errcode = '22023';
  end if;

  if p_preferences ? 'subjectPreparation' then
    if jsonb_typeof(p_preferences -> 'subjectPreparation') is distinct from 'array' then
      raise exception 'Subject preparation must be a JSON array.' using errcode = '22023';
    end if;
    if jsonb_array_length(p_preferences -> 'subjectPreparation') > 10 then
      raise exception 'Invalid subject preparation array.' using errcode = '22023';
    end if;
    if exists (
      select 1
        from jsonb_array_elements(p_preferences -> 'subjectPreparation') as item(value)
       where jsonb_typeof(item.value) is distinct from 'object'
          or jsonb_typeof(item.value -> 'subjectId') is distinct from 'string'
          or jsonb_typeof(item.value -> 'preparationLevel') is distinct from 'string'
          or item.value ->> 'subjectId' not in (
            'mathematics', 'informatics', 'physics', 'biology', 'chemistry',
            'economics', 'russian', 'history', 'social_studies', 'foreign_language'
          )
          or item.value ->> 'subjectId' <> all(v_subjects)
          or item.value ->> 'preparationLevel' not in ('beginner', 'medium', 'advanced')
    ) then
      raise exception 'Subject preparation must match selected subjects and known levels.' using errcode = '22023';
    end if;
    if exists (
      select item.value ->> 'subjectId'
        from jsonb_array_elements(p_preferences -> 'subjectPreparation') as item(value)
       group by item.value ->> 'subjectId'
      having count(*) > 1
    ) then
      raise exception 'Subject preparation entries must be unique.' using errcode = '22023';
    end if;
  end if;

  if p_preferences ? 'alternativeUniversityIds' then
    if jsonb_typeof(p_preferences -> 'alternativeUniversityIds') is distinct from 'array' then
      raise exception 'Alternative university ids must be a JSON array.' using errcode = '22023';
    end if;
    if jsonb_array_length(p_preferences -> 'alternativeUniversityIds') > 3 then
      raise exception 'At most three alternative universities are allowed.' using errcode = '22023';
    end if;
    if exists (
      select 1
        from jsonb_array_elements(p_preferences -> 'alternativeUniversityIds') as item(value)
       where jsonb_typeof(item.value) is distinct from 'string'
          or (item.value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) then
      raise exception 'Alternative university ids must be UUID strings.' using errcode = '22023';
    end if;
    if exists (
      select item.value
        from jsonb_array_elements_text(p_preferences -> 'alternativeUniversityIds') as item(value)
       group by item.value
      having count(*) > 1
    ) then
      raise exception 'Alternative universities must be unique.' using errcode = '22023';
    end if;
    if v_target_university_id is not null and exists (
      select 1
        from jsonb_array_elements_text(p_preferences -> 'alternativeUniversityIds') as item(value)
       where item.value::uuid = v_target_university_id
    ) then
      raise exception 'Primary university cannot also be an alternative.' using errcode = '23514';
    end if;
  end if;

  -- Keep the same first lock as generation/task-status RPCs. A concurrent
  -- profile save and plan generation cannot commit from mismatched snapshots.
  perform 1
    from public.profiles
   where id = v_user_id
   for update;

  -- This upsert and all dependent table updates run in the same PostgreSQL transaction.
  insert into public.profiles (
    id, email, full_name, grade, region, subjects,
    target_university_id, target_program_id, onboarding_completed, updated_at
  ) values (
    v_user_id, v_email, v_full_name, v_grade, v_region, v_subjects,
    v_target_university_id, v_target_program_id, true, pg_catalog.now()
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    grade = excluded.grade,
    region = excluded.region,
    subjects = excluded.subjects,
    target_university_id = excluded.target_university_id,
    target_program_id = excluded.target_program_id,
    onboarding_completed = true,
    updated_at = pg_catalog.now();

  if p_preferences <> '{}'::jsonb then
    update public.profiles
       set weekly_study_hours = case when p_preferences ? 'weeklyStudyHours'
             then (p_preferences ->> 'weeklyStudyHours')::smallint else weekly_study_hours end,
           target_admission_year = case when p_preferences ? 'targetAdmissionYear'
             then (p_preferences ->> 'targetAdmissionYear')::smallint else target_admission_year end,
           target_education_level = case when p_preferences ? 'targetEducationLevel'
             then p_preferences ->> 'targetEducationLevel' else target_education_level end,
           updated_at = pg_catalog.now()
     where id = v_user_id;
  end if;

  if p_preferences ? 'subjectPreparation' then
    delete from public.profile_subject_preparation where user_id = v_user_id;
    insert into public.profile_subject_preparation (user_id, subject_id, preparation_level)
    select v_user_id, item.value ->> 'subjectId', item.value ->> 'preparationLevel'
      from jsonb_array_elements(p_preferences -> 'subjectPreparation') as item(value);
  else
    -- Preserve known levels for still-selected subjects, but remove stale rows
    -- when an older client changes the subject list without sending this field.
    delete from public.profile_subject_preparation
     where user_id = v_user_id
       and subject_id <> all(v_subjects);
  end if;

  if p_preferences ? 'alternativeUniversityIds' then
    delete from public.profile_alternative_universities where user_id = v_user_id;
    insert into public.profile_alternative_universities (user_id, university_id, priority)
    select v_user_id, item.value::uuid, item.ordinality::smallint
      from jsonb_array_elements_text(p_preferences -> 'alternativeUniversityIds')
        with ordinality as item(value, ordinality);
  end if;
end;
$$;

comment on function public.save_profile_bundle(uuid, text, text, jsonb, jsonb) is
  'Backend-service-only invoker-rights RPC. Express authenticates the end-user and supplies the verified id; public clients cannot execute this function.';

revoke all on function public.save_profile_bundle(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_profile_bundle(uuid, text, text, jsonb, jsonb) to service_role;

-- Additional profile tables are read-only through the Data API. Writes are
-- performed only inside save_profile_bundle, keeping profile timestamps in sync.
revoke all on table public.profile_subject_preparation, public.profile_alternative_universities
  from public, anon, authenticated, service_role;
grant select on table public.profile_subject_preparation, public.profile_alternative_universities
  to authenticated;
grant select, insert, update, delete on table public.profile_subject_preparation, public.profile_alternative_universities
  to service_role;

-- The backend service role performs all profile writes through the atomic RPC.
grant select, insert, update on table public.profiles to service_role;
grant select on table public.programs to service_role;

-- Browser clients may read their own profile and update only display preferences.
-- Remove any inherited/default public and anonymous access before granting the narrow role set.
revoke all on table public.profiles from public, anon;
-- Core academic/planning fields can only be changed through save_profile_bundle.
revoke insert, update, delete, truncate, references, trigger on table public.profiles
  from public, anon, authenticated;
revoke insert (
  id, email, full_name, grade, region, subjects,
  target_university_id, target_program_id, weekly_study_hours,
  target_admission_year, target_education_level,
  onboarding_completed, created_at, updated_at,
  theme_preference, notification_preferences
) on table public.profiles from public, anon, authenticated;
revoke update (
  id, email, full_name, grade, region, subjects,
  target_university_id, target_program_id, weekly_study_hours,
  target_admission_year, target_education_level,
  onboarding_completed, created_at, updated_at
) on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (theme_preference, notification_preferences)
  on table public.profiles to authenticated;

-- Retire the older split-write RPC; the backend now uses save_profile_bundle.
revoke all on function public.save_profile_planning_preferences(jsonb)
  from public, anon, authenticated, service_role;

-- Stable keys allow a regenerated plan to carry progress forward without
-- depending on generated UUIDs or array positions.
alter table public.trajectory_stages
  add column stable_key text;

update public.trajectory_stages
   set stable_key = 'legacy-stage:' || id::text
 where stable_key is null;

alter table public.trajectory_stages
  alter column stable_key set not null;

create unique index trajectory_stages_plan_stable_key_idx
  on public.trajectory_stages(plan_id, stable_key);

alter table public.trajectory_tasks
  add column stable_key text,
  add column weekly_minutes smallint;

update public.trajectory_tasks
   set stable_key = 'legacy-task:' || id::text
 where stable_key is null;

alter table public.trajectory_tasks
  alter column stable_key set not null;

alter table public.trajectory_tasks
  add constraint trajectory_tasks_weekly_minutes_valid
  check (weekly_minutes is null or weekly_minutes between 5 and 2400);

create unique index trajectory_tasks_plan_stable_key_idx
  on public.trajectory_tasks(plan_id, stable_key);

-- Keep plan, stage and task writes behind narrowly scoped backend RPC functions.
-- User JWTs can read their own rows through RLS but cannot execute write RPCs.
-- The backend secret key maps to service_role and is never exposed to clients.
revoke all on table
  public.trajectory_plans,
  public.trajectory_stages,
  public.trajectory_tasks
from public, anon;
revoke insert, update, delete, truncate, references, trigger on table
  public.trajectory_plans,
  public.trajectory_stages,
  public.trajectory_tasks
from public, anon, authenticated;

grant select on table
  public.trajectory_plans,
  public.trajectory_stages,
  public.trajectory_tasks
to authenticated;

grant select, insert, update, delete on table
  public.trajectory_plans,
  public.trajectory_stages,
  public.trajectory_tasks
to service_role;

alter table public.trajectory_stages
  add constraint trajectory_stages_stable_key_valid
  check (length(trim(stable_key)) between 1 and 120);

alter table public.trajectory_tasks
  add constraint trajectory_tasks_stable_key_valid
  check (length(trim(stable_key)) between 1 and 160);

-- A client-generated UUID makes POST /generate safe to retry after network
-- timeouts or accidental double-clicks. The same key returns the same plan.
alter table public.trajectory_plans
  add column generation_request_id uuid;

create unique index trajectory_plans_generation_request_unique_idx
  on public.trajectory_plans(user_id, generation_request_id)
  where generation_request_id is not null;

create index trajectory_plans_user_created_at_idx
  on public.trajectory_plans(user_id, created_at desc);

-- The former authenticated-user signature is removed. Only the backend service key
-- can execute the new signature after Express has verified the user's access token.
drop function if exists public.create_trajectory_plan(jsonb);

-- Create and activate a plan as one database transaction. A profile row lock
-- serializes concurrent generation requests for the same user.
create function public.create_trajectory_plan(p_user_id uuid, p_plan jsonb)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := p_user_id;
  v_request_id uuid;
  v_existing_plan_id uuid;
  v_previous_plan_id uuid;
  v_plan_id uuid;
  v_version integer;
  v_stage_json jsonb;
  v_task_json jsonb;
  v_stage_position integer;
  v_task_position integer;
  v_stage_id uuid;
  v_stage_key text;
  v_task_key text;
  v_stage_type text;
  v_task_type text;
  v_priority text;
  v_title text;
  v_description text;
  v_start_date date;
  v_end_date date;
  v_due_date date;
  v_estimated_minutes integer;
  v_weekly_minutes smallint;
  v_related_olympiad_id uuid;
  v_related_university_id uuid;
  v_related_program_id uuid;
  v_source_url text;
  v_source_label text;
  v_previous_task_status text;
  v_previous_completed_at timestamptz;
  v_total_tasks integer;
  v_done_tasks integer;
  v_skipped_tasks integer;
  v_in_progress_tasks integer;
  v_task_count integer := 0;
  v_snapshot jsonb;
  v_current_profile_updated_at timestamptz;
  v_expected_profile_updated_at timestamptz;
  v_recent_generation_count integer := 0;
  v_daily_generation_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Verified user id is required.' using errcode = '22023';
  end if;

  if p_plan is null or jsonb_typeof(p_plan) is distinct from 'object' then
    raise exception 'Plan must be a JSON object.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_plan -> 'stages') is distinct from 'array' then
    raise exception 'Plan stages must be a JSON array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_plan -> 'stages') < 1
     or jsonb_array_length(p_plan -> 'stages') > 12 then
    raise exception 'Plan must contain between one and twelve stages.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_plan -> 'profileSnapshot') is distinct from 'object' then
    raise exception 'Profile snapshot must be a JSON object.' using errcode = '22023';
  end if;

  if nullif(trim(p_plan ->> 'title'), '') is null
     or length(p_plan ->> 'title') > 180 then
    raise exception 'Plan title is required and must be at most 180 characters.' using errcode = '22023';
  end if;

  if p_plan ? 'summary' and length(coalesce(p_plan ->> 'summary', '')) > 1200 then
    raise exception 'Plan summary is too long.' using errcode = '22023';
  end if;

  if nullif(p_plan ->> 'requestId', '') is null then
    raise exception 'Generation request id is required.' using errcode = '22023';
  end if;

  begin
    v_request_id := (p_plan ->> 'requestId')::uuid;
  exception when invalid_text_representation then
    raise exception 'Generation request id must be a UUID.' using errcode = '22023';
  end;

  -- First lookup is a fast path; the second lookup after the lock closes races.
  select id into v_existing_plan_id
    from public.trajectory_plans
   where user_id = v_user_id
     and generation_request_id = v_request_id;
  if found then
    return v_existing_plan_id;
  end if;

  select updated_at
    into v_current_profile_updated_at
    from public.profiles
   where id = v_user_id
   for update;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_plan -> 'profileUpdatedAt') is distinct from 'string'
     or nullif(p_plan ->> 'profileUpdatedAt', '') is null then
    raise exception 'Profile update timestamp is required.' using errcode = '22023';
  end if;
  begin
    v_expected_profile_updated_at := (p_plan ->> 'profileUpdatedAt')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'Profile update timestamp is invalid.' using errcode = '22023';
  end;
  if v_current_profile_updated_at is distinct from v_expected_profile_updated_at then
    raise exception 'Profile changed while the trajectory was being prepared. Retry generation.' using errcode = '40001';
  end if;

  select id into v_existing_plan_id
    from public.trajectory_plans
   where user_id = v_user_id
     and generation_request_id = v_request_id;
  if found then
    return v_existing_plan_id;
  end if;

  -- Enforced in PostgreSQL (not only Express), so direct RPC calls cannot bypass it.
  select
    count(*) filter (where created_at >= pg_catalog.now() - interval '15 minutes')::integer,
    count(*) filter (where created_at >= pg_catalog.now() - interval '24 hours')::integer
    into v_recent_generation_count, v_daily_generation_count
    from public.trajectory_plans
   where user_id = v_user_id;

  if v_recent_generation_count >= 3 or v_daily_generation_count >= 12 then
    raise exception 'TRAJECTORY_GENERATION_RATE_LIMIT'
      using errcode = 'P0001',
            detail = 'Limit: three successful generations per fifteen minutes and twelve per rolling twenty-four hours.';
  end if;

  select id into v_previous_plan_id
    from public.trajectory_plans
   where user_id = v_user_id
     and status = 'active'
   for update;

  select coalesce(max(version), 0) + 1
    into v_version
    from public.trajectory_plans
   where user_id = v_user_id;

  update public.trajectory_plans
     set status = 'superseded',
         superseded_at = pg_catalog.now()
   where user_id = v_user_id
     and status = 'active';

  v_snapshot := p_plan -> 'profileSnapshot';

  insert into public.trajectory_plans (
    user_id,
    version,
    status,
    title,
    summary,
    academic_year,
    rule_version,
    profile_snapshot,
    generation_request_id,
    activated_at
  ) values (
    v_user_id,
    v_version,
    'active',
    trim(p_plan ->> 'title'),
    nullif(p_plan ->> 'summary', ''),
    nullif(p_plan ->> 'academicYear', ''),
    coalesce(nullif(p_plan ->> 'ruleVersion', ''), 'rules-v1'),
    v_snapshot,
    v_request_id,
    pg_catalog.now()
  ) returning id into v_plan_id;

  for v_stage_json, v_stage_position in
    select item.value, item.ordinality::integer
      from jsonb_array_elements(p_plan -> 'stages') with ordinality as item(value, ordinality)
  loop
    if jsonb_typeof(v_stage_json) is distinct from 'object' then
      raise exception 'Each stage must be a JSON object.' using errcode = '22023';
    end if;

    v_stage_key := nullif(trim(v_stage_json ->> 'stableKey'), '');
    v_stage_type := coalesce(v_stage_json ->> 'stageType', 'other');
    v_title := nullif(trim(v_stage_json ->> 'title'), '');
    v_description := nullif(v_stage_json ->> 'description', '');

    if v_stage_key is null or length(v_stage_key) > 120
       or v_title is null or length(v_title) > 180
       or length(coalesce(v_description, '')) > 1600 then
      raise exception 'Stage key or title is invalid.' using errcode = '22023';
    end if;

    if v_stage_type not in ('foundation', 'subject_preparation', 'olympiads', 'exam_preparation', 'admission', 'portfolio', 'other') then
      raise exception 'Unsupported trajectory stage type.' using errcode = '22023';
    end if;

    if jsonb_typeof(v_stage_json -> 'tasks') is distinct from 'array' then
      raise exception 'Each stage must contain a task array.' using errcode = '22023';
    end if;
    if jsonb_array_length(v_stage_json -> 'tasks') > 100 then
      raise exception 'Each stage can contain at most 100 tasks.' using errcode = '22023';
    end if;

    v_start_date := null;
    v_end_date := null;
    if nullif(v_stage_json ->> 'startDate', '') is not null then
      if (v_stage_json ->> 'startDate') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Stage start date must use YYYY-MM-DD.' using errcode = '22023';
      end if;
      v_start_date := (v_stage_json ->> 'startDate')::date;
    end if;
    if nullif(v_stage_json ->> 'endDate', '') is not null then
      if (v_stage_json ->> 'endDate') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Stage end date must use YYYY-MM-DD.' using errcode = '22023';
      end if;
      v_end_date := (v_stage_json ->> 'endDate')::date;
    end if;

    insert into public.trajectory_stages (
      plan_id,
      user_id,
      stable_key,
      position,
      stage_type,
      title,
      description,
      status,
      start_date,
      end_date
    ) values (
      v_plan_id,
      v_user_id,
      v_stage_key,
      v_stage_position,
      v_stage_type,
      v_title,
      v_description,
      'not_started',
      v_start_date,
      v_end_date
    ) returning id into v_stage_id;

    for v_task_json, v_task_position in
      select item.value, item.ordinality::integer
        from jsonb_array_elements(v_stage_json -> 'tasks') with ordinality as item(value, ordinality)
    loop
      v_task_count := v_task_count + 1;
      if v_task_count > 500 then
        raise exception 'A trajectory plan cannot contain more than 500 tasks.' using errcode = '22023';
      end if;

      if jsonb_typeof(v_task_json) is distinct from 'object' then
        raise exception 'Each task must be a JSON object.' using errcode = '22023';
      end if;

      v_task_key := nullif(trim(v_task_json ->> 'stableKey'), '');
      v_title := nullif(trim(v_task_json ->> 'title'), '');
      v_description := nullif(v_task_json ->> 'description', '');
      v_task_type := coalesce(v_task_json ->> 'taskType', 'study');
      v_priority := coalesce(v_task_json ->> 'priority', 'medium');

      if v_task_key is null or length(v_task_key) > 160
         or v_title is null or length(v_title) > 240
         or length(coalesce(v_description, '')) > 2400 then
        raise exception 'Task key or title is invalid.' using errcode = '22023';
      end if;

      if v_task_type not in ('study', 'olympiad', 'exam', 'research', 'application', 'portfolio', 'review', 'other') then
        raise exception 'Unsupported trajectory task type.' using errcode = '22023';
      end if;
      if v_priority not in ('low', 'medium', 'high') then
        raise exception 'Unsupported trajectory task priority.' using errcode = '22023';
      end if;

      v_start_date := null;
      v_due_date := null;
      if nullif(v_task_json ->> 'startDate', '') is not null then
        if (v_task_json ->> 'startDate') !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'Task start date must use YYYY-MM-DD.' using errcode = '22023';
        end if;
        v_start_date := (v_task_json ->> 'startDate')::date;
      end if;
      if nullif(v_task_json ->> 'dueDate', '') is not null then
        if (v_task_json ->> 'dueDate') !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'Task due date must use YYYY-MM-DD.' using errcode = '22023';
        end if;
        v_due_date := (v_task_json ->> 'dueDate')::date;
      end if;

      if v_task_json ? 'estimatedMinutes' and jsonb_typeof(v_task_json -> 'estimatedMinutes') is distinct from 'number' then
        raise exception 'Estimated minutes must be a JSON number.' using errcode = '22023';
      end if;
      if v_task_json ? 'weeklyMinutes' and jsonb_typeof(v_task_json -> 'weeklyMinutes') is distinct from 'number' then
        raise exception 'Weekly minutes must be a JSON number.' using errcode = '22023';
      end if;

      if v_task_json ? 'estimatedMinutes' and (v_task_json ->> 'estimatedMinutes') !~ '^[0-9]+$' then
        raise exception 'Estimated minutes must be a whole number.' using errcode = '22023';
      end if;
      if v_task_json ? 'weeklyMinutes' and (v_task_json ->> 'weeklyMinutes') !~ '^[0-9]+$' then
        raise exception 'Weekly minutes must be a whole number.' using errcode = '22023';
      end if;

      v_estimated_minutes := nullif(v_task_json ->> 'estimatedMinutes', '')::integer;
      v_weekly_minutes := nullif(v_task_json ->> 'weeklyMinutes', '')::smallint;
      v_related_olympiad_id := nullif(v_task_json ->> 'relatedOlympiadId', '')::uuid;
      v_related_university_id := nullif(v_task_json ->> 'relatedUniversityId', '')::uuid;
      v_related_program_id := nullif(v_task_json ->> 'relatedProgramId', '')::uuid;
      v_source_url := nullif(v_task_json ->> 'sourceUrl', '');
      v_source_label := nullif(v_task_json ->> 'sourceLabel', '');

      if v_source_url is not null and v_source_url !~ '^https://[^[:space:]]+$' then
        raise exception 'Task source URL must use HTTPS.' using errcode = '22023';
      end if;
      if length(coalesce(v_source_label, '')) > 120 then
        raise exception 'Task source label is too long.' using errcode = '22023';
      end if;

      v_previous_task_status := 'todo';
      v_previous_completed_at := null;
      if v_previous_plan_id is not null then
        select status, completed_at
          into v_previous_task_status, v_previous_completed_at
          from public.trajectory_tasks
         where plan_id = v_previous_plan_id
           and user_id = v_user_id
           and stable_key = v_task_key;
        if not found then
          v_previous_task_status := 'todo';
          v_previous_completed_at := null;
        end if;
      end if;

      insert into public.trajectory_tasks (
        plan_id,
        stage_id,
        user_id,
        stable_key,
        position,
        title,
        description,
        task_type,
        priority,
        status,
        start_date,
        due_date,
        estimated_minutes,
        weekly_minutes,
        related_olympiad_id,
        related_university_id,
        related_program_id,
        source_url,
        source_label,
        completed_at
      ) values (
        v_plan_id,
        v_stage_id,
        v_user_id,
        v_task_key,
        v_task_position,
        v_title,
        v_description,
        v_task_type,
        v_priority,
        v_previous_task_status,
        v_start_date,
        v_due_date,
        v_estimated_minutes,
        v_weekly_minutes,
        v_related_olympiad_id,
        v_related_university_id,
        v_related_program_id,
        v_source_url,
        v_source_label,
        case when v_previous_task_status = 'completed' then coalesce(v_previous_completed_at, pg_catalog.now()) else null end
      );
    end loop;

    select
      count(*)::integer,
      count(*) filter (where status in ('completed', 'skipped'))::integer,
      count(*) filter (where status = 'skipped')::integer,
      count(*) filter (where status = 'in_progress')::integer
      into v_total_tasks, v_done_tasks, v_skipped_tasks, v_in_progress_tasks
      from public.trajectory_tasks
     where stage_id = v_stage_id
       and user_id = v_user_id;

    update public.trajectory_stages
       set status = case
         when v_total_tasks > 0 and v_skipped_tasks = v_total_tasks then 'skipped'
         when v_total_tasks > 0 and v_done_tasks = v_total_tasks then 'completed'
         when v_in_progress_tasks > 0 or v_done_tasks > 0 then 'in_progress'
         else 'not_started'
       end
     where id = v_stage_id
       and user_id = v_user_id;
  end loop;

  return v_plan_id;
end;
$$;

comment on function public.create_trajectory_plan(uuid, jsonb) is
  'Backend-service-only capability. Express authenticates the user and supplies the verified id; direct authenticated RPC execution is revoked.';

revoke all on function public.create_trajectory_plan(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.create_trajectory_plan(uuid, jsonb)
  to service_role;

-- Update one task and recalculate its parent stage atomically.
drop function if exists public.update_trajectory_task_status(uuid, text);

create function public.update_trajectory_task_status(
  p_user_id uuid,
  p_task_id uuid,
  p_status text
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := p_user_id;
  v_plan_id uuid;
  v_stage_id uuid;
  v_total_tasks integer;
  v_done_tasks integer;
  v_skipped_tasks integer;
  v_in_progress_tasks integer;
  v_new_stage_status text;
begin
  if v_user_id is null then
    raise exception 'Verified user id is required.' using errcode = '22023';
  end if;

  if p_status is null or p_status not in ('todo', 'in_progress', 'completed', 'skipped') then
    raise exception 'Unsupported task status.' using errcode = '22023';
  end if;

  -- Use the same lock order as create_trajectory_plan. This prevents a task
  -- completion racing with regeneration and being omitted from the new version.
  perform 1
    from public.profiles
   where id = v_user_id
   for update;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  update public.trajectory_tasks as task
     set status = p_status,
         completed_at = case
           when p_status = 'completed' then coalesce(task.completed_at, pg_catalog.now())
           else null
         end
    from public.trajectory_plans as plan
   where task.id = p_task_id
     and task.user_id = v_user_id
     and task.plan_id = plan.id
     and plan.user_id = v_user_id
     and plan.status = 'active'
  returning plan_id, stage_id into v_plan_id, v_stage_id;

  if not found then
    raise exception 'Trajectory task not found.' using errcode = 'P0002';
  end if;

  select
    count(*)::integer,
    count(*) filter (where status in ('completed', 'skipped'))::integer,
    count(*) filter (where status = 'skipped')::integer,
    count(*) filter (where status = 'in_progress')::integer
    into v_total_tasks, v_done_tasks, v_skipped_tasks, v_in_progress_tasks
    from public.trajectory_tasks
   where stage_id = v_stage_id
     and user_id = v_user_id;

  v_new_stage_status := case
    when v_total_tasks > 0 and v_skipped_tasks = v_total_tasks then 'skipped'
    when v_total_tasks > 0 and v_done_tasks = v_total_tasks then 'completed'
    when v_in_progress_tasks > 0 or v_done_tasks > 0 then 'in_progress'
    else 'not_started'
  end;

  update public.trajectory_stages
     set status = v_new_stage_status
   where id = v_stage_id
     and plan_id = v_plan_id
     and user_id = v_user_id;

  if not found then
    raise exception 'Trajectory stage not found.' using errcode = 'P0002';
  end if;

  return v_plan_id;
end;
$$;

comment on function public.update_trajectory_task_status(uuid, uuid, text) is
  'Backend-service-only capability. Express authenticates the user and supplies the verified id; direct authenticated RPC execution is revoked.';

revoke all on function public.update_trajectory_task_status(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_trajectory_task_status(uuid, uuid, text)
  to service_role;
