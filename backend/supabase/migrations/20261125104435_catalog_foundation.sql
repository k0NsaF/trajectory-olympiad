-- Trajectory V2: профессии, направления и проверяемые связи с программами.
-- Аддитивная миграция: не изменяет и не удаляет существующие universities/programs.

create table if not exists public.professions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  summary text not null,
  description text not null,
  typical_tasks text[] not null default '{}',
  skills text[] not null default '{}',
  school_subjects text[] not null default '{}',
  interests text[] not null default '{}',
  content_status text not null default 'editorial',
  source_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professions_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint professions_content_status_valid check (content_status in ('editorial', 'official', 'needs_review')),
  constraint professions_name_not_empty check (length(trim(name)) > 0)
);

create table if not exists public.education_directions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  code text not null unique,
  name text not null,
  education_level text not null,
  category text not null,
  summary text not null,
  description text not null,
  content_status text not null default 'editorial',
  source_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_directions_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint education_directions_level_valid check (education_level in ('bachelor', 'specialist', 'master')),
  constraint education_directions_content_status_valid check (content_status in ('editorial', 'official', 'needs_review')),
  constraint education_directions_name_not_empty check (length(trim(name)) > 0)
);

create table if not exists public.profession_direction_links (
  profession_id uuid not null references public.professions(id) on delete cascade,
  direction_id uuid not null references public.education_directions(id) on delete cascade,
  relationship text not null default 'related',
  rationale text not null,
  created_at timestamptz not null default now(),
  primary key (profession_id, direction_id),
  constraint profession_direction_relationship_valid check (relationship in ('primary', 'related')),
  constraint profession_direction_rationale_not_empty check (length(trim(rationale)) > 0)
);

-- Существующее programs.direction сохраняется. Связь с направлением становится
-- публичной только после проверки официальной страницы/документа программы.
create table if not exists public.program_direction_links (
  program_id uuid not null references public.programs(id) on delete cascade,
  direction_id uuid not null references public.education_directions(id) on delete cascade,
  source_url text,
  verification_status text not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (program_id, direction_id),
  constraint program_direction_verification_valid check (verification_status in ('pending', 'verified', 'rejected')),
  constraint program_direction_verified_source_required check (
    verification_status <> 'verified'
    or (source_url is not null and length(trim(source_url)) > 0)
  )
);

create index if not exists professions_published_name_idx
  on public.professions (name) where is_published = true;
create index if not exists professions_category_idx
  on public.professions (category) where is_published = true;
create index if not exists education_directions_published_name_idx
  on public.education_directions (name) where is_published = true;
create index if not exists education_directions_level_idx
  on public.education_directions (education_level) where is_published = true;
create index if not exists profession_direction_direction_idx
  on public.profession_direction_links (direction_id);
create index if not exists program_direction_direction_idx
  on public.program_direction_links (direction_id, verification_status);

drop trigger if exists professions_set_updated_at on public.professions;
create trigger professions_set_updated_at
before update on public.professions
for each row execute function public.set_updated_at();

drop trigger if exists education_directions_set_updated_at on public.education_directions;
create trigger education_directions_set_updated_at
before update on public.education_directions
for each row execute function public.set_updated_at();

alter table public.professions enable row level security;
alter table public.education_directions enable row level security;
alter table public.profession_direction_links enable row level security;
alter table public.program_direction_links enable row level security;

revoke all privileges on table
  public.professions, public.education_directions,
  public.profession_direction_links, public.program_direction_links
from public, anon, authenticated;

grant select on table
  public.professions, public.education_directions,
  public.profession_direction_links, public.program_direction_links
to anon, authenticated;

grant all privileges on table
  public.professions, public.education_directions,
  public.profession_direction_links, public.program_direction_links
to service_role;

drop policy if exists "Public can read published professions" on public.professions;
create policy "Public can read published professions"
on public.professions for select to anon, authenticated
using (is_published = true and content_status <> 'needs_review');

drop policy if exists "Public can read published education directions" on public.education_directions;
create policy "Public can read published education directions"
on public.education_directions for select to anon, authenticated
using (is_published = true and content_status <> 'needs_review');

drop policy if exists "Public can read published profession direction links" on public.profession_direction_links;
create policy "Public can read published profession direction links"
on public.profession_direction_links for select to anon, authenticated
using (
  exists (
    select 1 from public.professions p
    where p.id = profession_id and p.is_published = true and p.content_status <> 'needs_review'
  )
  and exists (
    select 1 from public.education_directions d
    where d.id = direction_id and d.is_published = true and d.content_status <> 'needs_review'
  )
);

drop policy if exists "Public can read verified program direction links" on public.program_direction_links;
create policy "Public can read verified program direction links"
on public.program_direction_links for select to anon, authenticated
using (
  verification_status = 'verified'
  and exists (
    select 1 from public.education_directions d
    where d.id = direction_id and d.is_published = true and d.content_status <> 'needs_review'
  )
);

-- Стартовые обзорные карточки. Связи профессия-направление являются редакционными
-- рекомендациями, а не гарантией единственно правильного выбора.
insert into public.education_directions
  (slug, code, name, education_level, category, summary, description, content_status, source_url, is_published)
values
  ('applied-mathematics-and-computer-science', '01.03.02', 'Прикладная математика и информатика', 'bachelor', 'Математика и IT',
   'Математические методы, алгоритмы и вычислительные модели для решения прикладных задач.',
   'Направление объединяет математическую подготовку, алгоритмы, моделирование и программные инструменты. Содержание конкретной программы и вступительные испытания определяет университет.',
   'editorial', 'https://www.minobrnauki.gov.ru/action/targeted_training/files/%D0%9C%D0%BE%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9%20%D0%BE%20%D0%B7%D0%B0%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%B0%20%D0%B8%D0%BB%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B2%20%D0%BE%20%D1%86%D0%B5%D0%BB%D0%B5%D0%B2%D0%BE%D0%BC%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B8.pdf', true),
  ('architecture', '07.03.01', 'Архитектура', 'bachelor', 'Архитектура и строительство',
   'Проектирование зданий и пространств с учётом функции, среды, конструкций и требований безопасности.',
   'В обучении сочетаются проектная работа, композиция, основы конструкций и цифровые инструменты. Требования к творческим испытаниям и портфолио нужно смотреть в правилах конкретного вуза.',
   'editorial', 'https://www.minobrnauki.gov.ru/action/targeted_training/files/%D0%9C%D0%BE%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9%20%D0%BE%20%D0%B7%D0%B0%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%B0%20%D0%B8%D0%BB%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B2%20%D0%BE%20%D1%86%D0%B5%D0%BB%D0%B5%D0%B2%D0%BE%D0%BC%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B8.pdf', true),
  ('information-computer-engineering', '09.03.01', 'Информатика и вычислительная техника', 'bachelor', 'Информатика и IT',
   'Аппаратное и программное обеспечение вычислительных систем, архитектура компьютеров и системное программирование.',
   'Направление охватывает устройство вычислительных систем, программные платформы, сети и инженерные методы разработки. Конкретные профили различаются по университетам.',
   'editorial', 'https://www.minobrnauki.gov.ru/action/targeted_training/files/%D0%9C%D0%BE%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9%20%D0%BE%20%D0%B7%D0%B0%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%B0%20%D0%B8%D0%BB%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B2%20%D0%BE%20%D1%86%D0%B5%D0%BB%D0%B5%D0%B2%D0%BE%D0%BC%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B8.pdf', true),
  ('information-systems-and-technologies', '09.03.02', 'Информационные системы и технологии', 'bachelor', 'Информатика и IT',
   'Проектирование, внедрение и сопровождение информационных систем и цифровых сервисов.',
   'Студенты изучают анализ требований, базы данных, программные платформы и управление жизненным циклом информационных систем. Наполнение программы зависит от вуза.',
   'editorial', 'https://www.minobrnauki.gov.ru/action/targeted_training/files/%D0%9C%D0%BE%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9%20%D0%BE%20%D0%B7%D0%B0%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%B0%20%D0%B8%D0%BB%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B2%20%D0%BE%20%D1%86%D0%B5%D0%BB%D0%B5%D0%B2%D0%BE%D0%BC%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B8.pdf', true),
  ('applied-informatics', '09.03.03', 'Прикладная информатика', 'bachelor', 'Информатика и IT',
   'Применение информационных технологий для автоматизации и улучшения процессов в организациях.',
   'Направление соединяет IT-инструменты с предметной областью: анализ процессов, данные, разработка и внедрение информационных решений. Конкретная специализация зависит от профиля программы.',
   'editorial', 'https://www.minobrnauki.gov.ru/action/targeted_training/files/%D0%9C%D0%BE%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9%20%D0%BE%20%D0%B7%D0%B0%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%B0%20%D0%B8%D0%BB%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B2%20%D0%BE%20%D1%86%D0%B5%D0%BB%D0%B5%D0%B2%D0%BE%D0%BC%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B8.pdf', true),
  ('software-engineering', '09.03.04', 'Программная инженерия', 'bachelor', 'Информатика и IT',
   'Инженерный подход к созданию, тестированию и сопровождению программных систем.',
   'В центре направления — полный цикл разработки программного обеспечения: требования, архитектура, код, тестирование, командная работа и сопровождение продукта.',
   'editorial', 'https://www.minobrnauki.gov.ru/action/targeted_training/files/%D0%9C%D0%BE%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9%20%D0%BE%20%D0%B7%D0%B0%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%B0%20%D0%B8%D0%BB%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B2%20%D0%BE%20%D1%86%D0%B5%D0%BB%D0%B5%D0%B2%D0%BE%D0%BC%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B8.pdf', true),
  ('information-security', '10.03.01', 'Информационная безопасность', 'bachelor', 'Информационная безопасность',
   'Защита информации, инфраструктуры и цифровых сервисов от угроз и нарушений.',
   'Изучаются основы защиты данных, сетей и информационных систем, оценка рисков и организационные меры безопасности. Конкретный профиль может быть техническим или организационным.',
   'editorial', 'https://www.minobrnauki.gov.ru/action/targeted_training/files/%D0%9C%D0%BE%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9%20%D0%BE%20%D0%B7%D0%B0%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%B0%20%D0%B8%D0%BB%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B2%20%D0%BE%20%D1%86%D0%B5%D0%BB%D0%B5%D0%B2%D0%BE%D0%BC%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B8.pdf', true),
  ('electronics-design-and-technology', '11.03.03', 'Конструирование и технология электронных средств', 'bachelor', 'Электроника и инженерия',
   'Проектирование электронных устройств, печатных узлов и технологий их производства.',
   'Направление связано с электроникой, схемотехникой, конструированием, технологиями изготовления и испытанием электронных средств.',
   'editorial', 'https://www.minobrnauki.gov.ru/action/targeted_training/files/%D0%9C%D0%BE%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9%20%D0%BE%20%D0%B7%D0%B0%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%B0%20%D0%B8%D0%BB%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B2%20%D0%BE%20%D1%86%D0%B5%D0%BB%D0%B5%D0%B2%D0%BE%D0%BC%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B8.pdf', true),
  ('economics', '38.03.01', 'Экономика', 'bachelor', 'Экономика и управление',
   'Анализ экономических процессов, финансовых показателей и решений организаций.',
   'Обучение может включать микро- и макроэкономику, статистику, финансы, учёт и анализ данных. Профиль и набор дисциплин определяет университет.',
   'editorial', 'https://www.minobrnauki.gov.ru/action/targeted_training/files/%D0%9C%D0%BE%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9%20%D0%BE%20%D0%B7%D0%B0%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%B0%20%D0%B8%D0%BB%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B2%20%D0%BE%20%D1%86%D0%B5%D0%BB%D0%B5%D0%B2%D0%BE%D0%BC%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B8.pdf', true),
  ('management', '38.03.02', 'Менеджмент', 'bachelor', 'Экономика и управление',
   'Организация работы команд и процессов, управление проектами и ресурсами.',
   'Направление изучает организацию деятельности, принятие управленческих решений, маркетинг, операции и проектную работу. Содержание конкретной программы может различаться.',
   'editorial', 'https://www.minobrnauki.gov.ru/action/targeted_training/files/%D0%9C%D0%BE%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9%20%D0%BE%20%D0%B7%D0%B0%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%B0%20%D0%B8%D0%BB%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B2%20%D0%BE%20%D1%86%D0%B5%D0%BB%D0%B5%D0%B2%D0%BE%D0%BC%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B8.pdf', true),
  ('law', '40.03.01', 'Юриспруденция', 'bachelor', 'Право и общество',
   'Изучение правовых норм, правоприменения, договорных и публично-правовых отношений.',
   'Подготовка включает основные отрасли права, анализ нормативных актов и практику работы с юридическими документами. Доступ к отдельным видам юридической деятельности определяется дополнительными требованиями.',
   'editorial', 'https://www.minobrnauki.gov.ru/action/targeted_training/files/%D0%9C%D0%BE%D0%B4%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9%20%D0%BE%20%D0%B7%D0%B0%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%B0%20%D0%B8%D0%BB%D0%B8%20%D0%B4%D0%BE%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B2%20%D0%BE%20%D1%86%D0%B5%D0%BB%D0%B5%D0%B2%D0%BE%D0%BC%20%D0%BE%D0%B1%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B8.pdf', true)
on conflict (slug) do nothing;

insert into public.professions
  (slug, name, category, summary, description, typical_tasks, skills, school_subjects, interests, content_status, is_published)
values
  ('software-developer', 'Разработчик программного обеспечения', 'Информационные технологии',
   'Создаёт приложения, сервисы и программные инструменты для решения задач людей и организаций.',
   'Разработчик анализирует задачу, проектирует решение, пишет и проверяет код, обсуждает изменения с командой и поддерживает готовый продукт. В профессии есть разные специализации: веб-разработка, мобильные приложения, системное программирование и другие.',
   array['Разбирать задачу и формулировать требования', 'Проектировать и реализовывать программные функции', 'Писать тесты и исправлять ошибки', 'Работать с кодом и документацией в команде'],
   array['Алгоритмическое мышление', 'Внимание к деталям', 'Умение разбираться в сложных системах', 'Командная коммуникация'],
   array['Информатика', 'Математика', 'Английский язык'],
   array['Создание цифровых продуктов', 'Логические задачи', 'Эксперименты с технологиями'], 'editorial', true),
  ('data-analyst', 'Аналитик данных', 'Аналитика и исследования',
   'Помогает находить закономерности в данных и превращать результаты анализа в решения.',
   'Аналитик собирает и очищает данные, выбирает методы анализа, проверяет гипотезы и объясняет выводы. Работа может быть связана с продуктами, финансами, исследованиями или производством.',
   array['Формулировать аналитические вопросы', 'Подготавливать и проверять данные', 'Строить расчёты и визуализации', 'Объяснять ограничения и выводы анализа'],
   array['Статистическое мышление', 'Работа с данными', 'Критическая оценка гипотез', 'Понятная коммуникация'],
   array['Математика', 'Информатика', 'Обществознание'],
   array['Поиск закономерностей', 'Исследования', 'Работа с цифрами'], 'editorial', true),
  ('cybersecurity-specialist', 'Специалист по информационной безопасности', 'Информационные технологии',
   'Помогает защищать данные, устройства, сети и цифровые сервисы.',
   'Специалист оценивает риски, выявляет уязвимости, настраивает защитные меры и помогает организациям реагировать на инциденты.',
   array['Оценивать риски и возможные угрозы', 'Проверять настройки систем', 'Анализировать события безопасности', 'Готовить рекомендации и документацию'],
   array['Системное мышление', 'Аккуратность', 'Техническая любознательность', 'Ответственность'],
   array['Информатика', 'Математика', 'Физика'],
   array['Компьютерные сети', 'Поиск причин сбоев', 'Защита информации'], 'editorial', true),
  ('architect', 'Архитектор', 'Архитектура и строительство',
   'Проектирует здания и пространства с учётом задач людей, среды и технических ограничений.',
   'Архитектор исследует контекст проекта, разрабатывает концепцию, готовит проектные материалы и взаимодействует с инженерами и заказчиком. Для поступления на некоторые программы могут быть творческие испытания.',
   array['Изучать участок и требования проекта', 'Разрабатывать планировочные решения', 'Готовить чертежи и визуализации', 'Согласовывать решения с инженерами и заказчиком'],
   array['Пространственное мышление', 'Визуальная коммуникация', 'Внимание к деталям', 'Проектная работа'],
   array['Математика', 'Рисунок и композиция', 'Физика'],
   array['Городская среда', 'Дизайн', 'Пространство и форма'], 'editorial', true),
  ('economist', 'Экономист', 'Экономика и управление',
   'Изучает экономические процессы и помогает оценивать последствия решений.',
   'Экономист анализирует показатели, готовит расчёты и сценарии, исследует рынки или деятельность организации.',
   array['Собирать и анализировать экономические показатели', 'Готовить расчёты и сценарии', 'Сравнивать варианты решений', 'Представлять результаты анализа'],
   array['Количественный анализ', 'Работа с таблицами', 'Критическое мышление', 'Письменная коммуникация'],
   array['Математика', 'Обществознание', 'Информатика'],
   array['Финансы', 'Рынки', 'Исследование причин и последствий'], 'editorial', true),
  ('lawyer', 'Юрист', 'Право и общество',
   'Работает с правовыми вопросами, документами и применением законодательства.',
   'Юрист анализирует обстоятельства и нормативные документы, готовит правовые позиции и помогает соблюдать требования закона.',
   array['Анализировать правовые документы', 'Готовить заключения и проекты документов', 'Оценивать правовые риски', 'Объяснять правовые варианты и ограничения'],
   array['Логика и аргументация', 'Работа с текстами', 'Внимание к формулировкам', 'Устная и письменная речь'],
   array['Обществознание', 'История', 'Русский язык'],
   array['Общественные процессы', 'Дискуссии', 'Правила и аргументация'], 'editorial', true),
  ('electronics-engineer', 'Инженер-электронщик', 'Электроника и инженерия',
   'Участвует в проектировании и испытании электронных устройств и систем.',
   'Инженер работает с электронными компонентами, схемами и технической документацией, проверяет прототипы и помогает довести устройство до надёжной работы.',
   array['Анализировать требования к устройству', 'Работать со схемами и компонентами', 'Проводить измерения и испытания', 'Документировать результаты'],
   array['Техническое мышление', 'Точность', 'Физическая интуиция', 'Системный подход'],
   array['Физика', 'Математика', 'Информатика'],
   array['Электроника', 'Конструирование', 'Эксперименты и измерения'], 'editorial', true)
on conflict (slug) do nothing;

insert into public.profession_direction_links (profession_id, direction_id, relationship, rationale)
select p.id, d.id, x.relationship, x.rationale
from (values
  ('software-developer', 'software-engineering', 'primary', 'Один из профильных вариантов подготовки к разработке программных систем.'),
  ('software-developer', 'information-computer-engineering', 'related', 'Подходит для интереса к системному программированию и вычислительной технике.'),
  ('software-developer', 'information-systems-and-technologies', 'related', 'Может подойти для разработки и внедрения информационных систем.'),
  ('software-developer', 'applied-informatics', 'related', 'Связывает разработку IT-решений с прикладной областью.'),
  ('software-developer', 'applied-mathematics-and-computer-science', 'related', 'Подходит при интересе к алгоритмам и математическим методам.'),
  ('data-analyst', 'applied-mathematics-and-computer-science', 'primary', 'Даёт математическую и вычислительную основу для анализа данных.'),
  ('data-analyst', 'applied-informatics', 'related', 'Может включать анализ данных и прикладные информационные решения.'),
  ('cybersecurity-specialist', 'information-security', 'primary', 'Профильное направление подготовки в области защиты информации.'),
  ('cybersecurity-specialist', 'information-computer-engineering', 'related', 'Может дать техническую основу для работы с вычислительными системами.'),
  ('architect', 'architecture', 'primary', 'Профильное направление архитектурного проектирования.'),
  ('economist', 'economics', 'primary', 'Профильное направление экономического анализа.'),
  ('economist', 'management', 'related', 'Смежный вариант для интереса к управлению организациями и процессами.'),
  ('lawyer', 'law', 'primary', 'Профильное направление юридического образования.'),
  ('electronics-engineer', 'electronics-design-and-technology', 'primary', 'Профильное направление конструирования электронных средств.')
) as x(profession_slug, direction_slug, relationship, rationale)
join public.professions p on p.slug = x.profession_slug
join public.education_directions d on d.slug = x.direction_slug
on conflict (profession_id, direction_id) do nothing;
