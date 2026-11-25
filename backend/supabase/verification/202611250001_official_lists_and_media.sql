-- Read-only verification queries. Run only AFTER applying
-- 202611250001_official_lists_and_university_media.sql to the intended project.

-- 1. Confirm year-level columns exist and show official-list distribution.
select
  academic_year,
  list_type,
  source_status,
  count(*) as season_count
from public.olympiad_seasons
group by academic_year, list_type, source_status
order by academic_year desc, list_type, source_status;

-- 2. Count olympiads by global compatibility classification and review status.
select list_type, source_status, count(*) as olympiad_count
from public.olympiads
group by list_type, source_status
order by list_type, source_status;

-- 3a. Benefits must not point to events globally classified as second-list competitions.
select b.id, b.olympiad_id, o.name, o.list_type, b.valid_year, b.verification_status
from public.benefits b
join public.olympiads o on o.id = b.olympiad_id
where o.list_type = 'intellectual_competition';

-- 3b. Benefits must not point to a season classified as a second-list event
-- for the admission year (for example, 2026 -> academic year 2025-2026).
select b.id, b.olympiad_id, o.name, s.academic_year, s.list_type, b.valid_year
from public.benefits b
join public.olympiads o on o.id = b.olympiad_id
join public.olympiad_seasons s
  on s.olympiad_id = b.olympiad_id
 and s.academic_year = ((b.valid_year - 1)::text || '-' || b.valid_year::text)
where s.list_type = 'intellectual_competition';

-- 4. Count verified university photos; unverified/incomplete metadata stays hidden.
select
  count(*) filter (
    where cover_image_url is not null
      and cover_image_source_url is not null
      and cover_image_license is not null
  ) as verified_photo_records,
  count(*) as university_records
from public.universities;

-- 5. Check that yearly competition records are not accidentally assigned levels.
select id, olympiad_id, academic_year, official_list_number, level, source_status
from public.olympiad_seasons
where list_type = 'intellectual_competition'
  and level is not null;
