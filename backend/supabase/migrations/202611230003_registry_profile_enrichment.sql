-- Обогащение карточек университетов адресами и доменами из профилей MICCEDU.
-- Миграция идемпотентна и не удаляет существующие данные.

alter table public.universities
  add column if not exists address text;

alter table public.university_official_domains
  drop constraint if exists university_official_domains_status_valid;

alter table public.university_official_domains
  add constraint university_official_domains_status_valid
  check (verification_status in (
    'candidate',
    'listed_by_ministry',
    'listed_by_miccedu',
    'verified',
    'rejected'
  ));

comment on column public.universities.address is
  'Официальный адрес организации из государственного реестра или подтверждённого профиля.';
