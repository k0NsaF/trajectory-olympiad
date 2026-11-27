alter table public.education_directions
  drop constraint if exists education_directions_code_key;

alter table public.education_directions
  add constraint education_directions_code_level_key
  unique (code, education_level);
