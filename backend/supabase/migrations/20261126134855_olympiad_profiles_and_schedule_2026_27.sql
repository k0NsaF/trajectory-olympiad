ALTER TABLE public.olympiads
  ADD CONSTRAINT olympiads_source_document_number_unique
  UNIQUE (source_document_url, official_list_number);

ALTER TABLE public.olympiad_seasons
  ADD CONSTRAINT olympiad_seasons_event_year_unique
  UNIQUE (olympiad_id, academic_year);

CREATE TABLE public.olympiad_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  olympiad_id uuid NOT NULL REFERENCES public.olympiads(id) ON DELETE CASCADE,
  source_profile_key text NOT NULL UNIQUE,
  source_event_slug text NOT NULL,
  order_n integer NOT NULL CHECK (order_n > 0),
  profile_name text NOT NULL CHECK (length(btrim(profile_name)) > 0),
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 3),
  source_subjects text NOT NULL DEFAULT '',
  subject_slugs text[] NOT NULL DEFAULT '{}',
  subjects text[] NOT NULL DEFAULT '{}',
  source_document_title text NOT NULL,
  source_document_url text NOT NULL,
  source_checked_on date NOT NULL,
  source_provider text NOT NULL DEFAULT 'Кодолимп',
  source_license text NOT NULL DEFAULT 'CC BY 4.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (olympiad_id, profile_name, level)
);

CREATE INDEX olympiad_profiles_olympiad_id_idx
  ON public.olympiad_profiles (olympiad_id);
CREATE INDEX olympiad_profiles_level_idx
  ON public.olympiad_profiles (level);
CREATE INDEX olympiad_profiles_subjects_gin_idx
  ON public.olympiad_profiles USING gin (subjects);

CREATE TABLE public.olympiad_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  olympiad_id uuid NOT NULL REFERENCES public.olympiads(id) ON DELETE CASCADE,
  source_item_key text NOT NULL UNIQUE,
  order_n integer NOT NULL CHECK (order_n > 0),
  kind text NOT NULL CHECK (kind IN ('registration', 'stage')),
  stage_name text NOT NULL DEFAULT '',
  when_text text NOT NULL CHECK (length(btrim(when_text)) > 0),
  is_confirmed boolean NOT NULL DEFAULT false,
  checked_on date NOT NULL,
  organizer_url text NOT NULL CHECK (organizer_url ~ '^https://[^[:space:]]+$'),
  start_date date,
  end_date date,
  date_parse_status text NOT NULL DEFAULT 'unknown'
    CHECK (date_parse_status IN ('exact', 'range', 'inferred_year', 'unknown')),
  source_provider text NOT NULL DEFAULT 'Кодолимп',
  source_license text NOT NULL DEFAULT 'CC BY 4.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX olympiad_schedule_items_olympiad_id_idx
  ON public.olympiad_schedule_items (olympiad_id);
CREATE INDEX olympiad_schedule_items_start_date_idx
  ON public.olympiad_schedule_items (start_date)
  WHERE is_confirmed = true AND start_date IS NOT NULL;
CREATE INDEX olympiad_schedule_items_end_date_idx
  ON public.olympiad_schedule_items (end_date)
  WHERE is_confirmed = true AND end_date IS NOT NULL;
CREATE INDEX olympiad_schedule_items_confirmed_idx
  ON public.olympiad_schedule_items (is_confirmed, checked_on);

ALTER TABLE public.olympiad_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olympiad_schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read olympiad profiles"
  ON public.olympiad_profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read olympiad schedule items"
  ON public.olympiad_schedule_items FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.olympiad_profiles, public.olympiad_schedule_items TO anon, authenticated;
GRANT ALL ON public.olympiad_profiles, public.olympiad_schedule_items TO service_role;

COMMENT ON TABLE public.olympiad_profiles IS
  'Official 2026/27 RSOSh profiles. Level belongs to a profile, not to the olympiad as a whole. Ministry order 521; dataset attribution: Codolymp CC BY 4.0.';
COMMENT ON TABLE public.olympiad_schedule_items IS
  'Organizer schedule notices. Unconfirmed or undated notices are preserved as source text and must not be used for automatic reminders.';
