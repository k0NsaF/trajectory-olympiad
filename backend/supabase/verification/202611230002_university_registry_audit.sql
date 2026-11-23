-- Проверка состояния единого реестра университетов после импорта.
-- Запускать в Supabase SQL Editor от имени администратора проекта.

select
  source_key,
  name,
  integration_status,
  last_imported_at
from public.university_registry_sources
order by source_key;

select
  source_key,
  match_status,
  count(*) as records
from public.university_registry_records
group by source_key, match_status
order by source_key, match_status;

select
  source_key,
  count(*) as records_total,
  count(*) filter (where metadata ->> 'profileEnriched' = 'true') as enriched_profiles,
  count(*) filter (where city is not null) as records_with_city,
  count(*) filter (where official_domain is not null) as records_with_official_domain,
  count(*) filter (where is_branch) as branches
from public.university_registry_records
group by source_key
order by source_key;

select
  registry_status,
  count(*) as universities
from public.universities
group by registry_status
order by registry_status;

select
  source_key,
  status,
  source_year,
  data_year,
  pages_seen,
  records_seen,
  records_upserted,
  universities_created,
  universities_matched,
  records_for_review,
  error_count,
  started_at,
  finished_at
from public.university_registry_import_runs
order by started_at desc
limit 20;

select
  name,
  short_name,
  city,
  address,
  region,
  official_domain,
  website,
  inn,
  ogrn,
  organization_type,
  is_branch,
  parent_university_id,
  registry_status,
  registry_sources,
  minobrnauki_admission_url,
  minobrnauki_rules_url,
  minobrnauki_places_url,
  miccedu_profile_url
from public.universities
where registry_status <> 'manual'
order by name
limit 200;

-- Филиалы, у которых головная организация ещё не сопоставлена.
select
  branch.id,
  branch.name,
  branch.city,
  branch.region,
  branch.official_domain,
  branch.miccedu_profile_url
from public.universities as branch
where branch.is_branch = true
  and branch.parent_university_id is null
order by branch.region, branch.name
limit 200;
