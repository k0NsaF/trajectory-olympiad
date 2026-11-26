-- =========================================================
-- TRAJECTORY: PERSONAL PLAN FOUNDATION
-- Profile extensions, plan history, stages, tasks and RLS.
-- =========================================================

-- 1. Extend existing student profile without removing old fields.

alter table public.profiles
  add column weekly_study_hours smallint,
  add column target_admission_year smallint,
  add column target_education_level text;

alter table public.profiles
  add constraint profiles_weekly_study_hours_valid
    check (
      weekly_study_hours is null
      or weekly_study_hours between 1 and 40
    ),
  add constraint profiles_target_admission_year_valid
    check (
      target_admission_year is null
      or target_admission_year between 2026 and 2100
    ),
  add constraint profiles_target_education_level_valid
    check (
      target_education_level is null
      or target_education_level in ('bachelor', 'specialist', 'master')
    );

-- Preparation level is stored separately for every selected subject.

create table public.profile_subject_preparation (
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  subject_id text not null,
  preparation_level text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_subject_preparation_pkey
    primary key (user_id, subject_id),

  constraint profile_subject_preparation_subject_valid
    check (
      subject_id in (
        'mathematics',
        'informatics',
        'physics',
        'biology',
        'chemistry',
        'economics',
        'russian',
        'history',
        'social_studies',
        'foreign_language'
      )
    ),

  constraint profile_subject_preparation_level_valid
    check (preparation_level in ('beginner', 'medium', 'advanced'))
);

-- Alternative universities. The existing target_university_id
-- remains the primary target and is not duplicated here.

create table public.profile_alternative_universities (
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  university_id uuid not null
    references public.universities(id) on delete cascade,
  priority smallint not null,
  created_at timestamptz not null default now(),

  constraint profile_alternative_universities_pkey
    primary key (user_id, university_id),

  constraint profile_alternative_universities_priority_valid
    check (priority between 1 and 3),

  constraint profile_alternative_universities_priority_unique
    unique (user_id, priority)
);

-- Prevent the primary university from also appearing as an alternative.

create or replace function public.enforce_profile_target_university_separation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_primary uuid;
begin
  if tg_table_name = 'profile_alternative_universities' then
    select p.target_university_id
      into current_primary
      from public.profiles p
      where p.id = new.user_id;

    if current_primary is not null
       and current_primary = new.university_id then
      raise exception 'Primary university cannot also be an alternative.'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if tg_table_name = 'profiles' then
    if new.target_university_id is not null then
      delete from public.profile_alternative_universities
       where user_id = new.id
         and university_id = new.target_university_id;
    end if;

    return new;
  end if;

  return new;
end;
$$;

create trigger profile_alternatives_prevent_primary_overlap
before insert or update of user_id, university_id
on public.profile_alternative_universities
for each row
execute function public.enforce_profile_target_university_separation();

create trigger profiles_prevent_primary_overlap
before update of target_university_id
on public.profiles
for each row
execute function public.enforce_profile_target_university_separation();

revoke all on function public.enforce_profile_target_university_separation()
  from public, anon, authenticated;

-- 2. Versioned trajectory plans.
-- Old plans remain stored when a new one becomes active.

create table public.trajectory_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id) on delete cascade,

  version integer not null,
  status text not null default 'draft',
  title text not null,
  summary text,

  academic_year text,
  rule_version text not null default 'rules-v1',
  profile_snapshot jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  activated_at timestamptz,
  superseded_at timestamptz,

  constraint trajectory_plans_user_version_unique
    unique (user_id, version),

  constraint trajectory_plans_id_user_unique
    unique (id, user_id),

  constraint trajectory_plans_version_valid
    check (version > 0),

  constraint trajectory_plans_status_valid
    check (status in ('draft', 'active', 'superseded', 'archived')),

  constraint trajectory_plans_title_not_empty
    check (length(trim(title)) > 0),

  constraint trajectory_plans_academic_year_valid
    check (
      academic_year is null
      or academic_year ~ '^[0-9]{4}-[0-9]{4}$'
    ),

  constraint trajectory_plans_snapshot_object
    check (jsonb_typeof(profile_snapshot) = 'object')
);

-- At most one active plan per student.

create unique index trajectory_plans_one_active_per_user_idx
  on public.trajectory_plans(user_id)
  where status = 'active';

create index trajectory_plans_user_history_idx
  on public.trajectory_plans(user_id, version desc);

-- 3. Stages belonging to a plan.

create table public.trajectory_stages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null,

  position smallint not null,
  stage_type text not null,
  title text not null,
  description text,

  status text not null default 'not_started',
  start_date date,
  end_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trajectory_stages_plan_owner_fk
    foreign key (plan_id, user_id)
    references public.trajectory_plans(id, user_id)
    on delete cascade,

  constraint trajectory_stages_plan_position_unique
    unique (plan_id, position),

  constraint trajectory_stages_id_plan_owner_unique
    unique (id, plan_id, user_id),

  constraint trajectory_stages_position_valid
    check (position > 0),

  constraint trajectory_stages_type_valid
    check (
      stage_type in (
        'foundation',
        'subject_preparation',
        'olympiads',
        'exam_preparation',
        'admission',
        'portfolio',
        'other'
      )
    ),

  constraint trajectory_stages_status_valid
    check (
      status in ('not_started', 'in_progress', 'completed', 'skipped')
    ),

  constraint trajectory_stages_title_not_empty
    check (length(trim(title)) > 0),

  constraint trajectory_stages_dates_valid
    check (
      start_date is null
      or end_date is null
      or end_date >= start_date
    )
);

create index trajectory_stages_plan_status_idx
  on public.trajectory_stages(plan_id, status, position);

-- 4. Personal tasks.
-- A task is bound to the same user's plan and stage through composite FKs.

create table public.trajectory_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  stage_id uuid not null,
  user_id uuid not null,

  position smallint not null,
  title text not null,
  description text,

  task_type text not null default 'study',
  priority text not null default 'medium',
  status text not null default 'todo',

  start_date date,
  due_date date,
  estimated_minutes integer,

  related_olympiad_id uuid
    references public.olympiads(id) on delete set null,
  related_university_id uuid
    references public.universities(id) on delete set null,
  related_program_id uuid,

  source_url text,
  source_label text,

  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trajectory_tasks_plan_owner_fk
    foreign key (plan_id, user_id)
    references public.trajectory_plans(id, user_id)
    on delete cascade,

  constraint trajectory_tasks_stage_owner_fk
    foreign key (stage_id, plan_id, user_id)
    references public.trajectory_stages(id, plan_id, user_id)
    on delete cascade,

  constraint trajectory_tasks_program_university_fk
    foreign key (related_program_id, related_university_id)
    references public.programs(id, university_id)
    on delete set null,

  constraint trajectory_tasks_position_valid
    check (position > 0),

  constraint trajectory_tasks_stage_position_unique
    unique (stage_id, position),

  constraint trajectory_tasks_type_valid
    check (
      task_type in (
        'study',
        'olympiad',
        'exam',
        'research',
        'application',
        'portfolio',
        'review',
        'other'
      )
    ),

  constraint trajectory_tasks_priority_valid
    check (priority in ('low', 'medium', 'high')),

  constraint trajectory_tasks_status_valid
    check (status in ('todo', 'in_progress', 'completed', 'skipped')),

  constraint trajectory_tasks_title_not_empty
    check (length(trim(title)) > 0),

  constraint trajectory_tasks_dates_valid
    check (
      start_date is null
      or due_date is null
      or due_date >= start_date
    ),

  constraint trajectory_tasks_estimated_minutes_valid
    check (
      estimated_minutes is null
      or estimated_minutes between 5 and 480
    ),

  constraint trajectory_tasks_program_requires_university
    check (
      related_program_id is null
      or related_university_id is not null
    ),

  constraint trajectory_tasks_source_url_https
    check (
      source_url is null
      or source_url ~ '^https://[^[:space:]]+$'
    )
);

create index trajectory_tasks_plan_status_idx
  on public.trajectory_tasks(plan_id, status, due_date);

create index trajectory_tasks_user_due_idx
  on public.trajectory_tasks(user_id, due_date)
  where status in ('todo', 'in_progress');

create index trajectory_tasks_related_olympiad_idx
  on public.trajectory_tasks(related_olympiad_id)
  where related_olympiad_id is not null;

-- 5. updated_at triggers.

create trigger profile_subject_preparation_set_updated_at
before update on public.profile_subject_preparation
for each row execute function public.set_updated_at();

create trigger trajectory_stages_set_updated_at
before update on public.trajectory_stages
for each row execute function public.set_updated_at();

create trigger trajectory_tasks_set_updated_at
before update on public.trajectory_tasks
for each row execute function public.set_updated_at();

-- 6. Row Level Security.

alter table public.profile_subject_preparation enable row level security;
alter table public.profile_alternative_universities enable row level security;
alter table public.trajectory_plans enable row level security;
alter table public.trajectory_stages enable row level security;
alter table public.trajectory_tasks enable row level security;

create policy "Users manage own subject preparation"
on public.profile_subject_preparation
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage own alternative universities"
on public.profile_alternative_universities
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage own trajectory plans"
on public.trajectory_plans
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage own trajectory stages"
on public.trajectory_stages
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage own trajectory tasks"
on public.trajectory_tasks
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- 7. Explicit Data API grants.
-- No access is granted to anon.

grant select, insert, update, delete on table
  public.profile_subject_preparation,
  public.profile_alternative_universities,
  public.trajectory_plans,
  public.trajectory_stages,
  public.trajectory_tasks
to authenticated;

grant select, insert, update, delete on table
  public.profile_subject_preparation,
  public.profile_alternative_universities,
  public.trajectory_plans,
  public.trajectory_stages,
  public.trajectory_tasks
to service_role;


-- 8. Atomically save optional planning preferences.
-- Missing JSON keys preserve existing values for older frontend clients.

create or replace function public.save_profile_planning_preferences(
  p_preferences jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_university_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object' then
    raise exception 'Planning preferences must be a JSON object.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_object_keys(p_preferences) as item(key)
     where item.key not in (
       'weeklyStudyHours',
       'targetAdmissionYear',
       'targetEducationLevel',
       'subjectPreparation',
       'alternativeUniversityIds'
     )
  ) then
    raise exception 'Unknown planning preference.'
      using errcode = '22023';
  end if;

  if p_preferences ? 'subjectPreparation' then
    if jsonb_typeof(p_preferences -> 'subjectPreparation') <> 'array'
       or jsonb_array_length(p_preferences -> 'subjectPreparation') > 10 then
      raise exception 'Invalid subject preparation array.'
        using errcode = '22023';
    end if;
  end if;

  if p_preferences ? 'alternativeUniversityIds' then
    if jsonb_typeof(p_preferences -> 'alternativeUniversityIds') <> 'array'
       or jsonb_array_length(p_preferences -> 'alternativeUniversityIds') > 3 then
      raise exception 'At most three alternative universities are allowed.'
        using errcode = '22023';
    end if;
  end if;

  update public.profiles
     set weekly_study_hours =
           case when p_preferences ? 'weeklyStudyHours'
             then (p_preferences ->> 'weeklyStudyHours')::smallint
             else weekly_study_hours end,
         target_admission_year =
           case when p_preferences ? 'targetAdmissionYear'
             then (p_preferences ->> 'targetAdmissionYear')::smallint
             else target_admission_year end,
         target_education_level =
           case when p_preferences ? 'targetEducationLevel'
             then p_preferences ->> 'targetEducationLevel'
             else target_education_level end,
         updated_at = pg_catalog.now()
   where id = v_user_id
   returning target_university_id into v_target_university_id;

  if not found then
    raise exception 'Profile not found.'
      using errcode = 'P0002';
  end if;

  if p_preferences ? 'subjectPreparation' then
    if exists (
      select 1
        from jsonb_array_elements(p_preferences -> 'subjectPreparation') as item(value)
       where jsonb_typeof(item.value) <> 'object'
    ) then
      raise exception 'Each subject preparation entry must be an object.'
        using errcode = '22023';
    end if;

    delete from public.profile_subject_preparation
     where user_id = v_user_id;

    insert into public.profile_subject_preparation (
      user_id,
      subject_id,
      preparation_level
    )
    select
      v_user_id,
      item.value ->> 'subjectId',
      item.value ->> 'preparationLevel'
    from jsonb_array_elements(p_preferences -> 'subjectPreparation') as item(value);
  end if;

  if p_preferences ? 'alternativeUniversityIds' then
    if v_target_university_id is not null
       and exists (
         select 1
           from jsonb_array_elements_text(p_preferences -> 'alternativeUniversityIds') as item(value)
          where item.value::uuid = v_target_university_id
       ) then
      raise exception 'Primary university cannot also be an alternative.'
        using errcode = '23514';
    end if;

    delete from public.profile_alternative_universities
     where user_id = v_user_id;

    insert into public.profile_alternative_universities (
      user_id,
      university_id,
      priority
    )
    select
      v_user_id,
      item.value::uuid,
      item.ordinality::smallint
    from jsonb_array_elements_text(p_preferences -> 'alternativeUniversityIds')
      with ordinality as item(value, ordinality);
  end if;
end;
$$;

revoke all on function public.save_profile_planning_preferences(jsonb)
  from public, anon;

grant execute on function public.save_profile_planning_preferences(jsonb)
  to authenticated;