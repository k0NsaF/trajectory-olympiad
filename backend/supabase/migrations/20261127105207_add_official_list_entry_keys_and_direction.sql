ALTER TABLE public.olympiads
  ADD COLUMN IF NOT EXISTS official_list_key text,
  ADD COLUMN IF NOT EXISTS level_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_direction text NOT NULL DEFAULT '';

ALTER TABLE public.olympiad_seasons
  ADD COLUMN IF NOT EXISTS official_list_key text,
  ADD COLUMN IF NOT EXISTS level_label text NOT NULL DEFAULT '';

ALTER TABLE public.olympiad_profiles
  ADD COLUMN IF NOT EXISTS source_direction text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS olympiads_source_document_entry_key_uidx
  ON public.olympiads (source_document_url, official_list_key)
  WHERE source_document_url IS NOT NULL AND official_list_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS olympiad_seasons_source_document_entry_key_uidx
  ON public.olympiad_seasons (source_document_url, official_list_key)
  WHERE source_document_url IS NOT NULL AND official_list_key IS NOT NULL;

COMMENT ON COLUMN public.olympiads.official_list_key IS 'Exact official document position such as 1.1 or 6.622; avoids lossy numeric conversions.';
COMMENT ON COLUMN public.olympiad_seasons.official_list_key IS 'Exact official position for this academic year and official list.';
COMMENT ON COLUMN public.olympiads.level_label IS 'Exact source level label when the event has one; profile-specific levels belong on olympiad_profiles.';
COMMENT ON COLUMN public.olympiad_profiles.source_direction IS 'Official broad direction/category from the source list, preserved verbatim.';
