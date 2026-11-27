ALTER TABLE public.olympiad_profiles
  ALTER COLUMN level DROP NOT NULL;

ALTER TABLE public.olympiad_profiles
  DROP CONSTRAINT IF EXISTS olympiad_profiles_level_check;

ALTER TABLE public.olympiad_profiles
  ADD CONSTRAINT olympiad_profiles_level_check
  CHECK (level IS NULL OR (level BETWEEN 1 AND 4));

ALTER TABLE public.olympiad_profiles
  ADD COLUMN IF NOT EXISTS level_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS eligible_grades integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS grade_eligibility_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS grade_source_url text,
  ADD COLUMN IF NOT EXISTS grade_checked_at timestamptz;

ALTER TABLE public.olympiad_profiles
  DROP CONSTRAINT IF EXISTS olympiad_profiles_eligible_grades_check;

ALTER TABLE public.olympiad_profiles
  ADD CONSTRAINT olympiad_profiles_eligible_grades_check
  CHECK (eligible_grades <@ ARRAY[7,8,9,10,11]);

ALTER TABLE public.olympiad_profiles
  DROP CONSTRAINT IF EXISTS olympiad_profiles_grade_eligibility_status_check;

ALTER TABLE public.olympiad_profiles
  ADD CONSTRAINT olympiad_profiles_grade_eligibility_status_check
  CHECK (grade_eligibility_status = ANY(ARRAY['unknown','needs_review','official']));

UPDATE public.olympiad_profiles
SET level_label = CASE level
  WHEN 1 THEN 'I уровень'
  WHEN 2 THEN 'II уровень'
  WHEN 3 THEN 'III уровень'
  WHEN 4 THEN 'IV уровень'
  ELSE 'Не установлен'
END
WHERE level_label = '';

COMMENT ON COLUMN public.olympiad_profiles.level IS 'Numeric level I-IV when the official list defines one; NULL for Высший уровень or Не установлен.';
COMMENT ON COLUMN public.olympiad_profiles.level_label IS 'Original official level label, including Высший уровень and Не установлен.';
COMMENT ON COLUMN public.olympiad_profiles.eligible_grades IS 'Verified school grades eligible for this exact olympiad profile; empty means unknown, not unrestricted.';
COMMENT ON COLUMN public.olympiad_profiles.grade_eligibility_status IS 'Official grade eligibility verification status; unknown must not be treated as eligible.';
COMMENT ON COLUMN public.olympiad_profiles.grade_source_url IS 'Organizer source URL proving eligible grades for this exact profile.';
COMMENT ON COLUMN public.olympiad_profiles.grade_checked_at IS 'Timestamp of last manual verification of eligible grades.';
