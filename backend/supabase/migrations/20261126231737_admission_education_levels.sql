-- Extend education levels for the updated Russian higher education model.
-- Legacy values remain supported.

ALTER TABLE public.program_admission_options
  DROP CONSTRAINT program_admission_options_education_level_check,
  ADD CONSTRAINT program_admission_options_education_level_check
    CHECK (education_level IN (
      'bachelor',
      'specialist',
      'master',
      'basic_higher',
      'specialized_higher'
    ));

ALTER TABLE public.education_directions
  DROP CONSTRAINT education_directions_level_valid,
  ADD CONSTRAINT education_directions_level_valid
    CHECK (education_level IN (
      'bachelor',
      'specialist',
      'master',
      'basic_higher',
      'specialized_higher'
    ));

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_target_education_level_valid,
  ADD CONSTRAINT profiles_target_education_level_valid
    CHECK (
      target_education_level IS NULL
      OR target_education_level IN (
        'bachelor',
        'specialist',
        'master',
        'basic_higher',
        'specialized_higher'
      )
    );