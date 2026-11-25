-- Already applied to remote Supabase on 2026-11-25.
-- Supporting indexes for foreign-key lookups and deletes.
create index if not exists achievements_olympiad_id_idx
  on public.achievements (olympiad_id)
  where olympiad_id is not null;

create index if not exists benefits_program_university_fk_idx
  on public.benefits (program_id, university_id);

create index if not exists profiles_target_program_university_fk_idx
  on public.profiles (target_program_id, target_university_id)
  where target_program_id is not null;

create index if not exists university_registry_records_matched_university_id_idx
  on public.university_registry_records (matched_university_id)
  where matched_university_id is not null;
