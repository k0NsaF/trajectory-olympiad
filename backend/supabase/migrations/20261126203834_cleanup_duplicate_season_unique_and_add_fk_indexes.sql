BEGIN;

-- Keep the original unique constraint from initial_schema.sql.
-- The later event_year constraint duplicates the same key and is not
-- referenced by any foreign key.
ALTER TABLE public.olympiad_seasons
  DROP CONSTRAINT olympiad_seasons_event_year_unique;

-- Supporting indexes for foreign-key checks and parent-row deletes.
CREATE INDEX profile_alternative_universities_university_id_idx
  ON public.profile_alternative_universities (university_id);

CREATE INDEX trajectory_stages_plan_user_idx
  ON public.trajectory_stages (plan_id, user_id);

CREATE INDEX trajectory_tasks_plan_user_idx
  ON public.trajectory_tasks (plan_id, user_id);

CREATE INDEX trajectory_tasks_program_university_idx
  ON public.trajectory_tasks (related_program_id, related_university_id);

CREATE INDEX trajectory_tasks_related_university_id_idx
  ON public.trajectory_tasks (related_university_id);

CREATE INDEX trajectory_tasks_stage_owner_idx
  ON public.trajectory_tasks (stage_id, plan_id, user_id);

COMMIT;