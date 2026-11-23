ALTER TABLE public.benefits
ADD COLUMN IF NOT EXISTS points_awarded integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'benefits_points_awarded_check'
      AND conrelid = 'public.benefits'::regclass
  ) THEN
    ALTER TABLE public.benefits
    ADD CONSTRAINT benefits_points_awarded_check
    CHECK (points_awarded IS NULL OR points_awarded BETWEEN 0 AND 100);
  END IF;
END
$$;

COMMENT ON COLUMN public.benefits.points_awarded IS
'Competition points awarded for an olympiad achievement. NULL means unknown or unverified.';
