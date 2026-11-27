-- P1 admission data model.
-- This migration is additive. It does not seed unverifiable admissions data.

ALTER TABLE public.programs
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS official_url text,
    ADD COLUMN IF NOT EXISTS source_url text,
    ADD COLUMN IF NOT EXISTS source_title text,
    ADD COLUMN IF NOT EXISTS source_checked_at timestamptz,
    ADD COLUMN IF NOT EXISTS catalog_status text NOT NULL DEFAULT 'needs_review';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'programs_catalog_status_check'
          AND conrelid = 'public.programs'::regclass
    ) THEN
        ALTER TABLE public.programs
            ADD CONSTRAINT programs_catalog_status_check
            CHECK (catalog_status IN ('needs_review', 'official', 'archived'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'programs_official_source_required'
          AND conrelid = 'public.programs'::regclass
    ) THEN
        ALTER TABLE public.programs
            ADD CONSTRAINT programs_official_source_required
            CHECK (
                catalog_status NOT IN ('official', 'archived')
                OR (
                    official_url IS NOT NULL
                    AND source_url IS NOT NULL
                    AND official_url ~ '^https://[^[:space:]]+$'
                    AND source_url ~ '^https://[^[:space:]]+$'
                    AND source_checked_at IS NOT NULL
                )
            );
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'programs_catalog_urls_https'
          AND conrelid = 'public.programs'::regclass
    ) THEN
        ALTER TABLE public.programs
            ADD CONSTRAINT programs_catalog_urls_https
            CHECK (
                (official_url IS NULL OR official_url ~ '^https://[^[:space:]]+$')
                AND (source_url IS NULL OR source_url ~ '^https://[^[:space:]]+$')
            );
    END IF;
END;
$$;

-- Only verified catalogue entries are visible to public clients.
DROP POLICY IF EXISTS "Public can read programs" ON public.programs;
DROP POLICY IF EXISTS "Public can read published programs" ON public.programs;
CREATE POLICY "Public can read published programs"
    ON public.programs
    FOR SELECT
    TO anon, authenticated
    USING (catalog_status IN ('official', 'archived'));

DROP POLICY IF EXISTS "Public can read university benefits" ON public.benefits;
CREATE POLICY "Public can read university benefits"
    ON public.benefits
    FOR SELECT
    TO anon, authenticated
    USING (verification_status IN ('official', 'archived'));

REVOKE ALL PRIVILEGES ON TABLE public.programs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.programs TO anon, authenticated;
GRANT ALL ON TABLE public.programs TO service_role;

-- Keep historical admission data instead of cascading its deletion.
ALTER TABLE public.programs
    DROP CONSTRAINT IF EXISTS programs_university_id_fkey;
ALTER TABLE public.programs
    ADD CONSTRAINT programs_university_id_fkey
    FOREIGN KEY (university_id)
    REFERENCES public.universities(id) ON DELETE RESTRICT;

ALTER TABLE public.benefits
    DROP CONSTRAINT IF EXISTS benefits_olympiad_id_fkey;
ALTER TABLE public.benefits
    ADD CONSTRAINT benefits_olympiad_id_fkey
    FOREIGN KEY (olympiad_id)
    REFERENCES public.olympiads(id) ON DELETE RESTRICT;

ALTER TABLE public.benefits
    DROP CONSTRAINT IF EXISTS benefits_university_id_fkey;
ALTER TABLE public.benefits
    ADD CONSTRAINT benefits_university_id_fkey
    FOREIGN KEY (university_id)
    REFERENCES public.universities(id) ON DELETE RESTRICT;

ALTER TABLE public.benefits
    DROP CONSTRAINT IF EXISTS benefits_program_university_fk;
ALTER TABLE public.benefits
    ADD CONSTRAINT benefits_program_university_fk
    FOREIGN KEY (program_id, university_id)
    REFERENCES public.programs(id, university_id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.university_admission_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE RESTRICT,
    admission_year smallint NOT NULL CHECK (admission_year BETWEEN 2020 AND 2200),
    campaign_status text NOT NULL DEFAULT 'not_published'
        CHECK (campaign_status IN ('not_published', 'collecting', 'published', 'archived')),
    source_status text NOT NULL DEFAULT 'needs_review'
        CHECK (source_status IN ('needs_review', 'official')),
    admission_page_url text,
    rules_url text,
    rules_title text,
    exam_list_url text,
    places_url text,
    tuition_url text,
    rules_published_at date,
    source_checked_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT university_admission_campaigns_year_unique UNIQUE (university_id, admission_year),
    CONSTRAINT university_admission_campaigns_id_owner_unique UNIQUE (id, university_id),
    CONSTRAINT university_admission_campaigns_published_source_required CHECK (
        campaign_status NOT IN ('published', 'archived')
        OR (
            source_status = 'official'
            AND rules_url IS NOT NULL
            AND source_checked_at IS NOT NULL
        )
    ),
    CONSTRAINT university_admission_campaigns_https_urls CHECK (
        (admission_page_url IS NULL OR admission_page_url ~ '^https://[^[:space:]]+$')
        AND (rules_url IS NULL OR rules_url ~ '^https://[^[:space:]]+$')
        AND (exam_list_url IS NULL OR exam_list_url ~ '^https://[^[:space:]]+$')
        AND (places_url IS NULL OR places_url ~ '^https://[^[:space:]]+$')
        AND (tuition_url IS NULL OR tuition_url ~ '^https://[^[:space:]]+$')
    )
);

CREATE TABLE IF NOT EXISTS public.program_admission_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_campaign_id uuid NOT NULL,
    university_id uuid NOT NULL,
    program_id uuid NOT NULL,
    program_code text,
    competition_group text,
    campus_name text,
    education_level text NOT NULL DEFAULT 'bachelor'
        CHECK (education_level IN ('bachelor', 'specialist', 'master')),
    admission_basis text NOT NULL DEFAULT 'general'
        CHECK (admission_basis IN ('general', 'target_quota', 'special_quota', 'separate_quota', 'paid', 'other')),
    study_form text NOT NULL DEFAULT 'full_time'
        CHECK (study_form IN ('full_time', 'part_time', 'mixed', 'distance', 'unknown')),
    study_duration_years numeric(3,1)
        CHECK (study_duration_years IS NULL OR study_duration_years BETWEEN 1 AND 10),
    budget_places integer CHECK (budget_places IS NULL OR budget_places >= 0),
    paid_places integer CHECK (paid_places IS NULL OR paid_places >= 0),
    tuition_rub_per_year bigint CHECK (tuition_rub_per_year IS NULL OR tuition_rub_per_year >= 0),
    instruction_language text,
    official_program_url text,
    source_url text NOT NULL,
    source_title text,
    source_checked_at timestamptz,
    verification_status text NOT NULL DEFAULT 'needs_review'
        CHECK (verification_status IN ('draft', 'needs_review', 'official', 'archived')),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT program_admission_options_campaign_owner_fk
        FOREIGN KEY (admission_campaign_id, university_id)
        REFERENCES public.university_admission_campaigns(id, university_id) ON DELETE RESTRICT,
    CONSTRAINT program_admission_options_program_owner_fk
        FOREIGN KEY (program_id, university_id)
        REFERENCES public.programs(id, university_id) ON DELETE RESTRICT,
    CONSTRAINT program_admission_options_id_owner_unique UNIQUE (id, university_id),
    CONSTRAINT program_admission_options_official_source_required CHECK (
        verification_status NOT IN ('official', 'archived')
        OR source_checked_at IS NOT NULL
    ),
    CONSTRAINT program_admission_options_https_urls CHECK (
        source_url ~ '^https://[^[:space:]]+$'
        AND (official_program_url IS NULL OR official_program_url ~ '^https://[^[:space:]]+$')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS program_admission_options_identity_idx
    ON public.program_admission_options (
        admission_campaign_id,
        program_id,
        COALESCE(campus_name, ''),
        education_level,
        admission_basis,
        study_form,
        COALESCE(competition_group, '')
    );

CREATE TABLE IF NOT EXISTS public.program_admission_exams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_admission_option_id uuid NOT NULL
        REFERENCES public.program_admission_options(id) ON DELETE RESTRICT,
    slot_number smallint NOT NULL CHECK (slot_number BETWEEN 1 AND 10),
    subject_id text,
    subject_name text NOT NULL CHECK (length(btrim(subject_name)) > 0),
    subject_code text,
    exam_type text NOT NULL DEFAULT 'ege'
        CHECK (exam_type IN ('ege', 'internal', 'creative', 'portfolio', 'other')),
    minimum_score smallint CHECK (minimum_score IS NULL OR minimum_score BETWEEN 0 AND 100),
    maximum_score smallint NOT NULL DEFAULT 100 CHECK (maximum_score BETWEEN 1 AND 100),
    evidence_url text,
    evidence_checked_at timestamptz,
    evidence_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT program_admission_exams_score_range CHECK (
        minimum_score IS NULL OR minimum_score <= maximum_score
    ),
    CONSTRAINT program_admission_exams_evidence_https CHECK (
        evidence_url IS NULL
        OR (
            evidence_url ~ '^https://[^[:space:]]+$'
            AND evidence_checked_at IS NOT NULL
        )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS program_admission_exams_slot_subject_unique
    ON public.program_admission_exams (
        program_admission_option_id,
        slot_number,
        COALESCE(NULLIF(btrim(subject_id), ''), lower(btrim(subject_name))),
        exam_type
    );

CREATE TABLE IF NOT EXISTS public.program_admission_achievement_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_admission_option_id uuid NOT NULL
        REFERENCES public.program_admission_options(id) ON DELETE RESTRICT,
    achievement_code text NOT NULL CHECK (length(btrim(achievement_code)) BETWEEN 1 AND 100),
    title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
    description text,
    points_awarded smallint NOT NULL CHECK (points_awarded BETWEEN 0 AND 100),
    points_cap smallint CHECK (points_cap IS NULL OR points_cap BETWEEN 0 AND 100),
    source_url text NOT NULL,
    source_title text,
    source_checked_at timestamptz,
    verification_status text NOT NULL DEFAULT 'needs_review'
        CHECK (verification_status IN ('draft', 'needs_review', 'official', 'archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT program_admission_achievement_source_required CHECK (
        verification_status NOT IN ('official', 'archived') OR source_checked_at IS NOT NULL
    ),
    CONSTRAINT program_admission_achievement_https CHECK (
        source_url ~ '^https://[^[:space:]]+$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS program_admission_achievement_identity_idx
    ON public.program_admission_achievement_rules (program_admission_option_id, achievement_code);

CREATE TABLE IF NOT EXISTS public.university_admission_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_campaign_id uuid NOT NULL
        REFERENCES public.university_admission_campaigns(id) ON DELETE RESTRICT,
    event_type text NOT NULL
        CHECK (event_type IN (
            'application_open',
            'application_deadline',
            'entrance_exams',
            'original_documents_deadline',
            'consent_deadline',
            'enrollment_order',
            'tuition_payment_deadline',
            'other'
        )),
    title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
    start_date date NOT NULL,
    end_date date NOT NULL,
    start_time time,
    end_time time,
    time_zone text NOT NULL DEFAULT 'Europe/Moscow',
    source_url text NOT NULL,
    source_title text,
    source_checked_at timestamptz,
    verification_status text NOT NULL DEFAULT 'needs_review'
        CHECK (verification_status IN ('draft', 'needs_review', 'official', 'archived')),
    public_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT university_admission_events_date_range CHECK (end_date >= start_date),
    CONSTRAINT university_admission_events_time_range CHECK (
        start_time IS NULL
        OR end_time IS NULL
        OR end_date > start_date
        OR end_time >= start_time
    ),
    CONSTRAINT university_admission_events_verified_source CHECK (
        verification_status NOT IN ('official', 'archived')
        OR source_checked_at IS NOT NULL
    ),
    CONSTRAINT university_admission_events_https_source CHECK (
        source_url ~ '^https://[^[:space:]]+$'
    )
);

CREATE INDEX IF NOT EXISTS university_admission_campaigns_year_idx
    ON public.university_admission_campaigns (admission_year DESC, university_id);

CREATE INDEX IF NOT EXISTS program_admission_options_program_idx
    ON public.program_admission_options (program_id, verification_status);

CREATE INDEX IF NOT EXISTS program_admission_options_campaign_idx
    ON public.program_admission_options (admission_campaign_id, verification_status);

CREATE INDEX IF NOT EXISTS program_admission_exams_subject_idx
    ON public.program_admission_exams (subject_id, program_admission_option_id);

CREATE INDEX IF NOT EXISTS university_admission_events_campaign_date_idx
    ON public.university_admission_events (admission_campaign_id, start_date, end_date);
DROP TRIGGER IF EXISTS university_admission_campaigns_set_updated_at
    ON public.university_admission_campaigns;
CREATE TRIGGER university_admission_campaigns_set_updated_at
    BEFORE UPDATE ON public.university_admission_campaigns
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS program_admission_options_set_updated_at
    ON public.program_admission_options;
CREATE TRIGGER program_admission_options_set_updated_at
    BEFORE UPDATE ON public.program_admission_options
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS program_admission_achievement_rules_set_updated_at
    ON public.program_admission_achievement_rules;
CREATE TRIGGER program_admission_achievement_rules_set_updated_at
    BEFORE UPDATE ON public.program_admission_achievement_rules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS university_admission_events_set_updated_at
    ON public.university_admission_events;
CREATE TRIGGER university_admission_events_set_updated_at
    BEFORE UPDATE ON public.university_admission_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.university_admission_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_admission_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_admission_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_admission_achievement_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_admission_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published admission campaigns" ON public.university_admission_campaigns;
CREATE POLICY "Public can read published admission campaigns"
    ON public.university_admission_campaigns
    FOR SELECT
    TO anon, authenticated
    USING (campaign_status IN ('published', 'archived') AND source_status = 'official');

DROP POLICY IF EXISTS "Public can read verified program admission options" ON public.program_admission_options;
CREATE POLICY "Public can read verified program admission options"
    ON public.program_admission_options
    FOR SELECT
    TO anon, authenticated
    USING (
        verification_status IN ('official', 'archived')
        AND EXISTS (
            SELECT 1
            FROM public.university_admission_campaigns c
            WHERE c.id = admission_campaign_id
              AND c.university_id = program_admission_options.university_id
              AND c.campaign_status IN ('published', 'archived')
              AND c.source_status = 'official'
        )
        AND EXISTS (
            SELECT 1
            FROM public.programs p
            WHERE p.id = program_admission_options.program_id
              AND p.university_id = program_admission_options.university_id
              AND p.catalog_status IN ('official', 'archived')
        )
    );

DROP POLICY IF EXISTS "Public can read published program admission exams" ON public.program_admission_exams;
CREATE POLICY "Public can read published program admission exams"
    ON public.program_admission_exams
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.program_admission_options o
            WHERE o.id = program_admission_option_id
              AND o.verification_status IN ('official', 'archived')
        )
    );

DROP POLICY IF EXISTS "Public can read published program achievement rules" ON public.program_admission_achievement_rules;
CREATE POLICY "Public can read published program achievement rules"
    ON public.program_admission_achievement_rules
    FOR SELECT
    TO anon, authenticated
    USING (
        verification_status IN ('official', 'archived')
        AND EXISTS (
            SELECT 1
            FROM public.program_admission_options o
            WHERE o.id = program_admission_option_id
              AND o.verification_status IN ('official', 'archived')
        )
    );

CREATE POLICY "Public can read published university admission events"
    ON public.university_admission_events
    FOR SELECT
    TO anon, authenticated
    USING (
        verification_status IN ('official', 'archived')
        AND EXISTS (
            SELECT 1
            FROM public.university_admission_campaigns c
            WHERE c.id = admission_campaign_id
              AND c.campaign_status IN ('published', 'archived')
              AND c.source_status = 'official'
        )
    );

REVOKE ALL ON TABLE public.university_admission_campaigns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.program_admission_options FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.program_admission_exams FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.program_admission_achievement_rules FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.university_admission_campaigns TO anon, authenticated;
GRANT SELECT ON TABLE public.program_admission_options TO anon, authenticated;
GRANT SELECT ON TABLE public.program_admission_exams TO anon, authenticated;
GRANT SELECT ON TABLE public.program_admission_achievement_rules TO anon, authenticated;

GRANT ALL ON TABLE public.university_admission_campaigns TO service_role;
GRANT ALL ON TABLE public.program_admission_options TO service_role;
GRANT ALL ON TABLE public.program_admission_exams TO service_role;
GRANT ALL ON TABLE public.program_admission_achievement_rules TO service_role;

REVOKE ALL ON TABLE public.university_admission_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.university_admission_events TO anon, authenticated;
GRANT ALL ON TABLE public.university_admission_events TO service_role;

COMMENT ON TABLE public.university_admission_campaigns IS
    'Versioned official admission campaign per university and year. Published rows require official rules URL and verification timestamp.';
COMMENT ON TABLE public.program_admission_options IS
    'A concrete admission option for a program in a specific university campaign, campus, study form, and competition group.';
COMMENT ON TABLE public.program_admission_exams IS
    'Entrance exam slots for an admission option. Multiple rows with the same slot_number are alternatives; distinct slots are required.';
COMMENT ON TABLE public.program_admission_achievement_rules IS
    'Official points for non-olympiad individual achievements for a specific program admission option.';
COMMENT ON TABLE public.university_admission_events IS
    'Versioned, source-checked admission calendar events and deadlines for a university admission campaign.';
COMMENT ON COLUMN public.program_admission_exams.slot_number IS
    'Rows sharing a slot_number are alternative exams; each required slot must be satisfied by one of its alternatives.';
COMMENT ON COLUMN public.program_admission_options.verification_status IS
    'Only official or archived records under an official campaign are exposed to public users.';