-- Add explicit separation between the two Ministry-maintained event lists.
-- Existing olympiad records remain in the school olympiad list until reviewed.
alter table public.olympiads
  add column if not exists list_type text not null default 'school_olympiad',
  add column if not exists official_list_number integer,
  add column if not exists source_document_title text,
  add column if not exists source_document_url text,
  add column if not exists source_checked_at timestamptz,
  add column if not exists source_status text not null default 'needs_review';

alter table public.olympiads
  drop constraint if exists olympiads_list_type_check,
  drop constraint if exists olympiads_source_status_check,
  drop constraint if exists olympiads_official_list_number_positive,
  drop constraint if exists olympiads_competition_has_no_level;

alter table public.olympiads
  add constraint olympiads_list_type_check
    check (list_type in ('school_olympiad', 'intellectual_competition')),
  add constraint olympiads_source_status_check
    check (source_status in ('official', 'needs_review', 'archived')),
  add constraint olympiads_official_list_number_positive
    check (official_list_number is null or official_list_number > 0),
  add constraint olympiads_competition_has_no_level
    check (list_type <> 'intellectual_competition' or level is null);

create index if not exists olympiads_list_type_name_idx
  on public.olympiads (list_type, name);

-- Official-list attributes are year-specific: an event may be listed differently
-- or have a different level in a later academic year.
alter table public.olympiad_seasons
  add column if not exists list_type text,
  add column if not exists official_list_number integer,
  add column if not exists level smallint,
  add column if not exists source_document_title text,
  add column if not exists source_document_url text,
  add column if not exists source_checked_at timestamptz,
  add column if not exists source_status text;

alter table public.olympiad_seasons
  drop constraint if exists olympiad_seasons_list_type_check,
  drop constraint if exists olympiad_seasons_official_list_number_positive,
  drop constraint if exists olympiad_seasons_level_check,
  drop constraint if exists olympiad_seasons_source_status_check,
  drop constraint if exists olympiad_seasons_competition_has_no_level;

alter table public.olympiad_seasons
  add constraint olympiad_seasons_list_type_check
    check (list_type is null or list_type in ('school_olympiad', 'intellectual_competition')),
  add constraint olympiad_seasons_official_list_number_positive
    check (official_list_number is null or official_list_number > 0),
  add constraint olympiad_seasons_level_check
    check (level is null or level between 1 and 4),
  add constraint olympiad_seasons_source_status_check
    check (source_status is null or source_status in ('official', 'needs_review', 'archived')),
  add constraint olympiad_seasons_competition_has_no_level
    check (list_type <> 'intellectual_competition' or level is null);

create index if not exists olympiad_seasons_list_type_year_idx
  on public.olympiad_seasons (list_type, academic_year);

comment on column public.olympiad_seasons.list_type is 'Тип официального перечня для конкретного учебного года; NULL означает, что классификация ещё не импортирована.';
comment on column public.olympiad_seasons.level is 'Уровень олимпиады из официального перечня соответствующего учебного года; не переносить на другие годы автоматически.';
comment on column public.olympiad_seasons.source_status is 'Статус сверки записи сезона с первичным официальным документом.';

-- A competition from the second list must never acquire school-olympiad admission rights.
create or replace function public.guard_benefit_school_olympiad_only()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.olympiads o
    where o.id = new.olympiad_id
      and o.list_type <> 'school_olympiad'
  ) or exists (
    select 1
    from public.olympiad_seasons s
    where s.olympiad_id = new.olympiad_id
      and s.academic_year = ((new.valid_year - 1)::text || '-' || new.valid_year::text)
      and s.list_type = 'intellectual_competition'
  ) then
    raise exception 'Admission benefits can only reference school olympiads in the corresponding academic year.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_benefit_school_olympiad_only() from public;
revoke all on function public.guard_benefit_school_olympiad_only() from anon;
revoke all on function public.guard_benefit_school_olympiad_only() from authenticated;

drop trigger if exists benefits_school_olympiad_only on public.benefits;
create trigger benefits_school_olympiad_only
before insert or update of olympiad_id, valid_year on public.benefits
for each row execute function public.guard_benefit_school_olympiad_only();

-- Prevent a school olympiad that already has admission-right records from being
-- reclassified as a second-list competition without first reviewing those rights.
create or replace function public.guard_olympiad_reclassification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.list_type = 'intellectual_competition'
     and old.list_type = 'school_olympiad'
     and exists (
       select 1 from public.benefits b where b.olympiad_id = new.id
     ) then
    raise exception 'Remove or review university admission benefits before reclassifying this event as an intellectual competition.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_olympiad_reclassification() from public;
revoke all on function public.guard_olympiad_reclassification() from anon;
revoke all on function public.guard_olympiad_reclassification() from authenticated;

drop trigger if exists olympiads_reclassification_guard on public.olympiads;
create trigger olympiads_reclassification_guard
before update of list_type on public.olympiads
for each row execute function public.guard_olympiad_reclassification();

create or replace function public.guard_olympiad_season_reclassification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  should_check_benefits boolean := false;
begin
  if tg_op = 'INSERT' then
    should_check_benefits := true;
  else
    should_check_benefits :=
      old.list_type is distinct from new.list_type
      or old.academic_year is distinct from new.academic_year
      or old.olympiad_id is distinct from new.olympiad_id;
  end if;

  if new.list_type = 'intellectual_competition'
     and should_check_benefits
     and exists (
       select 1
       from public.benefits b
       where b.olympiad_id = new.olympiad_id
         and b.valid_year = split_part(new.academic_year, '-', 2)::integer
     ) then
    raise exception 'Review admission benefits for this academic year before classifying or moving the event into the intellectual competition list.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_olympiad_season_reclassification() from public;
revoke all on function public.guard_olympiad_season_reclassification() from anon;
revoke all on function public.guard_olympiad_season_reclassification() from authenticated;

drop trigger if exists olympiad_season_reclassification_guard on public.olympiad_seasons;
create trigger olympiad_season_reclassification_guard
before insert or update of list_type, academic_year, olympiad_id on public.olympiad_seasons
for each row execute function public.guard_olympiad_season_reclassification();

-- Optional image metadata. Only verified official or licensed URLs should be populated.
alter table public.universities
  add column if not exists cover_image_url text,
  add column if not exists cover_image_source_url text,
  add column if not exists cover_image_license text,
  add column if not exists cover_image_alt text;

comment on column public.universities.cover_image_url is 'Verified university photo URL; empty means show a neutral placeholder.';
comment on column public.universities.cover_image_source_url is 'Source page for the university photo.';
comment on column public.universities.cover_image_license is 'License or permission basis for displaying the photo.';
comment on column public.universities.cover_image_alt is 'Alternative text describing the verified university photo.';
