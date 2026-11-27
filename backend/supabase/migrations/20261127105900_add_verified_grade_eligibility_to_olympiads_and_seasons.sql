alter table public.olympiads
  add column if not exists grade_eligibility_status text not null default 'unknown',
  add column if not exists grade_source_url text,
  add column if not exists grade_checked_at timestamptz;

alter table public.olympiads
  drop constraint if exists olympiads_grade_eligibility_status_check;
alter table public.olympiads
  add constraint olympiads_grade_eligibility_status_check
  check (grade_eligibility_status = any(array['unknown','needs_review','official']));

alter table public.olympiad_seasons
  add column if not exists grade_eligibility_status text not null default 'unknown',
  add column if not exists grade_source_url text,
  add column if not exists grade_checked_at timestamptz;

alter table public.olympiad_seasons
  drop constraint if exists olympiad_seasons_grade_eligibility_status_check;
alter table public.olympiad_seasons
  add constraint olympiad_seasons_grade_eligibility_status_check
  check (grade_eligibility_status = any(array['unknown','needs_review','official']));

comment on column public.olympiads.grade_eligibility_status is 'Official verification status for general event grade eligibility; unknown is never assumed unrestricted.';
comment on column public.olympiad_seasons.grade_eligibility_status is 'Official verification status of grade eligibility for this specific season.';
comment on column public.olympiad_seasons.grade_source_url is 'Organizer source URL proving eligible grades for this season.';
comment on column public.olympiad_seasons.grade_checked_at is 'Timestamp of the last manual grade eligibility verification for this season.';
