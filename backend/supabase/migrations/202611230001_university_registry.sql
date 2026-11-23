-- Единый реестр университетов и источников государственных данных.
-- Миграция расширяет существующие таблицы и не удаляет старые данные.

alter table public.universities
  add column if not exists region text,
  add column if not exists official_domain text,
  add column if not exists inn text,
  add column if not exists ogrn text,
  add column if not exists organization_type text,
  add column if not exists is_branch boolean not null default false,
  add column if not exists parent_university_id uuid references public.universities(id) on delete set null,
  add column if not exists registry_status text not null default 'manual',
  add column if not exists registry_sources text[] not null default '{}',
  add column if not exists registry_last_seen_at timestamptz,
  add column if not exists minobrnauki_admission_url text,
  add column if not exists minobrnauki_rules_url text,
  add column if not exists minobrnauki_places_url text,
  add column if not exists miccedu_profile_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'universities_inn_format' and conrelid = 'public.universities'::regclass) then
    alter table public.universities
      add constraint universities_inn_format
      check (inn is null or inn ~ '^[0-9]{10}([0-9]{2})?$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_ogrn_format' and conrelid = 'public.universities'::regclass) then
    alter table public.universities
      add constraint universities_ogrn_format
      check (ogrn is null or ogrn ~ '^[0-9]{13}([0-9]{2})?$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'universities_registry_status_valid' and conrelid = 'public.universities'::regclass) then
    alter table public.universities
      add constraint universities_registry_status_valid
      check (registry_status in (
        'manual',
        'minobrnauki_listed',
        'miccedu_listed',
        'multiple_sources',
        'needs_review'
      ));
  end if;
end;
$$;

create index if not exists universities_official_domain_idx
  on public.universities (lower(official_domain))
  where official_domain is not null;

create index if not exists universities_inn_idx
  on public.universities (inn)
  where inn is not null;

create index if not exists universities_ogrn_idx
  on public.universities (ogrn)
  where ogrn is not null;

create index if not exists universities_region_idx
  on public.universities (region)
  where region is not null;

create index if not exists universities_parent_idx
  on public.universities (parent_university_id)
  where parent_university_id is not null;

create table if not exists public.university_registry_sources (
  source_key text primary key,
  name text not null,
  source_url text not null,
  purpose text not null,
  integration_status text not null,
  integration_note text,
  last_imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint university_registry_sources_status_valid check (
    integration_status in ('active_import', 'manual_verification', 'supplementary', 'not_available')
  )
);

insert into public.university_registry_sources (
  source_key, name, source_url, purpose, integration_status, integration_note
) values
  (
    'minobrnauki_admission',
    'Минобрнауки России — информация о правилах приёма',
    'https://minobrnauki.gov.ru/abitur/',
    'Каталог организаций, страницы приёмных кампаний, правила приёма и количество мест',
    'active_import',
    'HTML-каталог с пагинацией. Импортируются название организации и ссылки; наличие записи не подтверждает актуальность всех правил.'
  ),
  (
    'miccedu_monitoring',
    'Мониторинг организаций высшего образования',
    'https://monitoring.miccedu.ru/?m=vpo',
    'Организации и филиалы, регион, профиль мониторинга и ссылка на карточку организации',
    'active_import',
    'Последний опубликованный архив на момент миграции: 2025 год по данным за 2024 год. Это статистический реестр, а не текущие правила приёма.'
  ),
  (
    'rosobrnadzor_license',
    'Рособрнадзор — сводный реестр лицензий',
    'https://obrnadzor.gov.ru/gosudarstvennye-uslugi-i-funkczii/gosudarstvennye-uslugi/liczenzirovanie-obrazovatelnoj-deyatelnosti/svodnyj-reestr-liczenzij/',
    'Проверка лицензии и государственной аккредитации образовательной деятельности',
    'manual_verification',
    'Официальная страница реестра сохранена как источник проверки. Массовый публичный формат выгрузки не подтверждён; не использовать сторонние устаревшие копии как действующий реестр.'
  ),
  (
    'gosuslugi_vuznavigator',
    'Госуслуги — Подбор вуза',
    'https://www.gosuslugi.ru/vuznavigator',
    'Дополнительная проверка сведений о вузах и программах для поступающих',
    'supplementary',
    'Используется как дополнительный государственный сервис. Публичный API для массовой выгрузки не подтверждён.'
  )
on conflict (source_key) do update set
  name = excluded.name,
  source_url = excluded.source_url,
  purpose = excluded.purpose,
  integration_status = excluded.integration_status,
  integration_note = excluded.integration_note,
  updated_at = now();

create table if not exists public.university_registry_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.university_registry_sources(source_key),
  source_year integer,
  data_year integer,
  status text not null default 'running',
  pages_seen integer not null default 0,
  records_seen integer not null default 0,
  records_upserted integer not null default 0,
  universities_created integer not null default 0,
  universities_matched integer not null default 0,
  records_for_review integer not null default 0,
  error_count integer not null default 0,
  error_summary jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint university_registry_import_runs_status_valid check (
    status in ('running', 'completed', 'partial', 'failed')
  )
);

create index if not exists university_registry_import_runs_source_idx
  on public.university_registry_import_runs (source_key, started_at desc);

create table if not exists public.university_registry_records (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references public.university_registry_import_runs(id) on delete set null,
  source_key text not null references public.university_registry_sources(source_key),
  source_record_key text not null,
  source_year integer,
  data_year integer,
  organization_name text not null,
  normalized_name text not null,
  short_name text,
  city text,
  region text,
  address text,
  inn text,
  ogrn text,
  organization_type text,
  is_branch boolean not null default false,
  website_url text,
  official_domain text,
  admission_url text,
  rules_url text,
  places_url text,
  source_url text not null,
  metadata jsonb not null default '{}'::jsonb,
  matched_university_id uuid references public.universities(id) on delete set null,
  match_status text not null default 'pending',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint university_registry_records_match_status_valid check (
    match_status in ('pending', 'matched', 'created', 'review', 'rejected')
  ),
  constraint university_registry_records_inn_format check (
    inn is null or inn ~ '^[0-9]{10}([0-9]{2})?$'
  ),
  constraint university_registry_records_ogrn_format check (
    ogrn is null or ogrn ~ '^[0-9]{13}([0-9]{2})?$'
  ),
  constraint university_registry_records_unique_source_key unique (source_key, source_record_key)
);

create index if not exists university_registry_records_name_idx
  on public.university_registry_records (normalized_name);

create index if not exists university_registry_records_domain_idx
  on public.university_registry_records (lower(official_domain))
  where official_domain is not null;

create index if not exists university_registry_records_run_idx
  on public.university_registry_records (import_run_id);

create index if not exists university_registry_records_match_idx
  on public.university_registry_records (match_status, source_key);

create table if not exists public.university_external_ids (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  source_key text not null references public.university_registry_sources(source_key),
  external_id text not null,
  source_url text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint university_external_ids_unique_source unique (source_key, external_id),
  constraint university_external_ids_unique_link unique (university_id, source_key, external_id)
);

create index if not exists university_external_ids_university_idx
  on public.university_external_ids (university_id);

create table if not exists public.university_official_domains (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  domain text not null,
  domain_role text not null default 'main',
  verification_status text not null default 'candidate',
  verification_method text not null,
  source_url text not null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint university_official_domains_role_valid check (
    domain_role in ('main', 'admissions', 'rules', 'places', 'programs', 'documents', 'other')
  ),
  constraint university_official_domains_status_valid check (
    verification_status in ('candidate', 'listed_by_ministry', 'verified', 'rejected')
  ),
  constraint university_official_domains_domain_format check (
    domain = lower(domain)
    and domain !~ '^https?://'
    and domain !~ '[/:?# ]'
  ),
  constraint university_official_domains_unique unique (university_id, domain, domain_role)
);

create index if not exists university_official_domains_domain_idx
  on public.university_official_domains (lower(domain));

create or replace function public.set_university_registry_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists university_registry_sources_set_updated_at on public.university_registry_sources;
create trigger university_registry_sources_set_updated_at
before update on public.university_registry_sources
for each row execute function public.set_university_registry_updated_at();

drop trigger if exists university_registry_records_set_updated_at on public.university_registry_records;
create trigger university_registry_records_set_updated_at
before update on public.university_registry_records
for each row execute function public.set_university_registry_updated_at();

drop trigger if exists university_official_domains_set_updated_at on public.university_official_domains;
create trigger university_official_domains_set_updated_at
before update on public.university_official_domains
for each row execute function public.set_university_registry_updated_at();

alter table public.university_registry_sources enable row level security;
alter table public.university_registry_import_runs enable row level security;
alter table public.university_registry_records enable row level security;
alter table public.university_external_ids enable row level security;
alter table public.university_official_domains enable row level security;

revoke all privileges on table
  public.university_registry_sources,
  public.university_registry_import_runs,
  public.university_registry_records,
  public.university_external_ids,
  public.university_official_domains
from public, anon, authenticated;

grant all privileges on table
  public.university_registry_sources,
  public.university_registry_import_runs,
  public.university_registry_records,
  public.university_external_ids,
  public.university_official_domains
to service_role;

-- Новые справочники доступны только серверу с service-role/secret key.
-- Публичный клиент читает уже подтверждённые поля из public.universities.
