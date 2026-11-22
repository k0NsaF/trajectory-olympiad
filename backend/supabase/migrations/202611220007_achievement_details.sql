begin;

alter table public.achievements
  add column if not exists result_status text,
  add column if not exists grade smallint,
  add column if not exists achievement_year integer;

alter table public.achievements
  alter column achieved_at drop not null;

alter table public.achievements
  drop constraint if exists achievements_result_status_valid;

alter table public.achievements
  add constraint achievements_result_status_valid
  check (
    result_status is null
    or result_status in ('participant', 'prize', 'winner')
  );

alter table public.achievements
  drop constraint if exists achievements_grade_valid;

alter table public.achievements
  add constraint achievements_grade_valid
  check (grade is null or grade between 7 and 11);

alter table public.achievements
  drop constraint if exists achievements_year_valid;

alter table public.achievements
  add constraint achievements_year_valid
  check (
    achievement_year is null
    or achievement_year between 2000 and 2200
  );

create index if not exists achievements_user_year_idx
  on public.achievements(user_id, achievement_year desc);

grant insert (result_status, grade, achievement_year)
  on table public.achievements
  to authenticated;

commit;
