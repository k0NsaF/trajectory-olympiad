DROP INDEX IF EXISTS public.olympiads_source_document_entry_key_uidx;
CREATE UNIQUE INDEX olympiads_source_document_entry_key_uidx
  ON public.olympiads (source_document_url, official_list_key);

DROP INDEX IF EXISTS public.olympiad_seasons_source_document_entry_key_uidx;
CREATE UNIQUE INDEX olympiad_seasons_source_document_entry_key_uidx
  ON public.olympiad_seasons (source_document_url, official_list_key);
