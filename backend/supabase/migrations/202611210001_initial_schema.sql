
create extension if not exists pgcrypto;

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  city text not null,
  website text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint universities_name_not_empty check (length(trim(name)) > 0)
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  name text not null,
  direction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programs_name_not_empty check (length(trim(name)) > 0),
  constraint programs_university_name_unique unique (university_id, name),
  constraint programs_id_university_unique unique (id, university_id)
);

create table if not exists public.olympiads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organizer text not null,
  level smallint,
  subjects text[] not null default '{}',
  grades integer[] not null default '{}',
  website text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint olympiads_name_not_empty check (length(trim(name)) > 0),
  constraint olympiads_level_valid check (level is null or level between 1 and 4),
  constraint olympiads_subjects_valid check (
    subjects <@ array[
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
    ]::text[]
  ),
  constraint olympiads_grades_valid check (
    grades <@ array[7, 8, 9, 10, 11]::integer[]
  )
);

create table if not exists public.olympiad_seasons (
  id uuid primary key default gen_random_uuid(),
  olympiad_id uuid not null references public.olympiads(id) on delete cascade,
  academic_year text not null,
  grades integer[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint olympiad_seasons_year_format check (
    academic_year ~ '^[0-9]{4}-[0-9]{4}$'
  ),
  constraint olympiad_seasons_grades_valid check (
    grades <@ array[7, 8, 9, 10, 11]::integer[]
  ),
  constraint olympiad_seasons_olympiad_year_unique
    unique (olympiad_id, academic_year)
);

create table if not exists public.stages (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.olympiad_seasons(id) on delete cascade,
  type text not null,
  start_date date not null,
  end_date date not null,
  format text not null default 'online',
  region_scope text[],
  created_at timestamptz not null default now(),
  constraint stages_type_valid check (
    type in ('registration', 'qualifying', 'final')
  ),
  constraint stages_format_valid check (
    format in ('online', 'offline', 'mixed')
  ),
  constraint stages_dates_valid check (end_date >= start_date)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  grade smallint,
  region text,
  subjects text[] not null default '{}',
  target_university_id uuid references public.universities(id) on delete set null,
  target_program_id uuid,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_grade_valid check (
    grade is null or grade between 7 and 11
  ),
  constraint profiles_subjects_valid check (
    subjects <@ array[
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
    ]::text[]
  ),
  constraint profiles_target_program_university_fk
    foreign key (target_program_id, target_university_id)
    references public.programs(id, university_id)
    on delete set null
);

create table if not exists public.benefits (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  program_id uuid,
  olympiad_id uuid not null references public.olympiads(id) on delete cascade,
  right_type text not null,
  for_status text not null,
  level_required smallint not null,
  confirm_exam_threshold smallint,
  source_url text not null,
  valid_year integer not null,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint benefits_program_university_fk
    foreign key (program_id, university_id)
    references public.programs(id, university_id)
    on delete cascade,
  constraint benefits_right_type_valid check (
    right_type in ('BVI', '100_points', 'extra_points')
  ),
  constraint benefits_recipient_status_valid check (
    for_status in ('winner', 'prize', 'both')
  ),
  constraint benefits_level_valid check (
    level_required between 1 and 4
  ),
  constraint benefits_exam_threshold_valid check (
    confirm_exam_threshold is null
    or confirm_exam_threshold between 0 and 100
  ),
  constraint benefits_valid_year_valid check (
    valid_year between 2020 and 2200
  ),
  constraint benefits_source_not_empty check (
    length(trim(source_url)) > 0
  )
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  olympiad_id uuid references public.olympiads(id) on delete set null,
  olympiad_name text not null,
  title text not null,
  result text not null,
  achieved_at date not null,
  proof_url text,
  verification_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint achievements_status_valid check (
    verification_status in ('pending', 'verified', 'rejected')
  ),
  constraint achievements_title_not_empty check (length(trim(title)) > 0),
  constraint achievements_result_not_empty check (length(trim(result)) > 0)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  type text not null,
  status text not null default 'pending',
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_type_valid check (
    type in (
      'registration_deadline',
      'stage_start',
      'stage_end',
      'personal'
    )
  ),
  constraint reminders_status_valid check (
    status in ('pending', 'completed', 'dismissed')
  ),
  constraint reminders_title_not_empty check (length(trim(title)) > 0)
);

create index if not exists programs_university_id_idx
  on public.programs(university_id);

create index if not exists olympiads_subjects_idx
  on public.olympiads using gin(subjects);

create index if not exists olympiads_grades_idx
  on public.olympiads using gin(grades);

create index if not exists olympiad_seasons_year_idx
  on public.olympiad_seasons(academic_year);

create index if not exists stages_season_start_idx
  on public.stages(season_id, start_date);

create index if not exists benefits_university_year_idx
  on public.benefits(university_id, valid_year);

create index if not exists benefits_olympiad_id_idx
  on public.benefits(olympiad_id);

create index if not exists profiles_target_university_idx
  on public.profiles(target_university_id);

create index if not exists achievements_user_id_idx
  on public.achievements(user_id);

create index if not exists reminders_user_due_idx
  on public.reminders(user_id, due_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger universities_set_updated_at
before update on public.universities
for each row execute function public.set_updated_at();

create trigger programs_set_updated_at
before update on public.programs
for each row execute function public.set_updated_at();

create trigger olympiads_set_updated_at
before update on public.olympiads
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger benefits_set_updated_at
before update on public.benefits
for each row execute function public.set_updated_at();

create trigger achievements_set_updated_at
before update on public.achievements
for each row execute function public.set_updated_at();

create trigger reminders_set_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.universities enable row level security;
alter table public.programs enable row level security;
alter table public.olympiads enable row level security;
alter table public.olympiad_seasons enable row level security;
alter table public.stages enable row level security;
alter table public.profiles enable row level security;
alter table public.benefits enable row level security;
alter table public.achievements enable row level security;
alter table public.reminders enable row level security;

revoke all privileges on table
  public.universities,
  public.programs,
  public.olympiads,
  public.olympiad_seasons,
  public.stages,
  public.benefits
from public, anon, authenticated;

grant select on table
  public.universities,
  public.programs,
  public.olympiads,
  public.olympiad_seasons,
  public.stages,
  public.benefits
to anon, authenticated;

revoke all privileges on table
  public.profiles,
  public.achievements,
  public.reminders
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.achievements,
  public.reminders
to authenticated;

create policy "Public can read universities"
on public.universities
for select
to anon, authenticated
using (true);

create policy "Public can read programs"
on public.programs
for select
to anon, authenticated
using (true);

create policy "Public can read olympiads"
on public.olympiads
for select
to anon, authenticated
using (true);

create policy "Public can read olympiad seasons"
on public.olympiad_seasons
for select
to anon, authenticated
using (true);

create policy "Public can read olympiad stages"
on public.stages
for select
to anon, authenticated
using (true);

create policy "Public can read university benefits"
on public.benefits
for select
to anon, authenticated
using (true);

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can create own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can delete own profile"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = id);

create policy "Users can read own achievements"
on public.achievements
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own achievements"
on public.achievements
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own achievements"
on public.achievements
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own achievements"
on public.achievements
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own reminders"
on public.reminders
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own reminders"
on public.reminders
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own reminders"
on public.reminders
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own reminders"
on public.reminders
for delete
to authenticated
using ((select auth.uid()) = user_id);
