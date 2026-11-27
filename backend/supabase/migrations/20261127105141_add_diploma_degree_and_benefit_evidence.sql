ALTER TABLE public.benefits
  ADD COLUMN IF NOT EXISTS diploma_degree_required smallint,
  ADD COLUMN IF NOT EXISTS source_excerpt text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verification_notes text;

ALTER TABLE public.benefits
  DROP CONSTRAINT IF EXISTS benefits_diploma_degree_required_check;

ALTER TABLE public.benefits
  ADD CONSTRAINT benefits_diploma_degree_required_check
  CHECK (diploma_degree_required IS NULL OR diploma_degree_required BETWEEN 1 AND 3);

COMMENT ON COLUMN public.benefits.diploma_degree_required IS 'Required diploma degree (1st, 2nd or 3rd) as stated by the university rule; NULL when not restricted or not specified.';
COMMENT ON COLUMN public.benefits.source_excerpt IS 'Short manually transcribed excerpt from the official university source supporting this benefit.';
COMMENT ON COLUMN public.benefits.verification_notes IS 'Human verification notes explaining program scope, academic year and interpretation.';
