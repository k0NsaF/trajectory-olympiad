-- Supporting indexes for composite foreign keys in admission options.

CREATE INDEX IF NOT EXISTS program_admission_options_campaign_university_idx
    ON public.program_admission_options (admission_campaign_id, university_id);

CREATE INDEX IF NOT EXISTS program_admission_options_program_university_idx
    ON public.program_admission_options (program_id, university_id);