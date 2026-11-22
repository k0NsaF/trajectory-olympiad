
ALTER TABLE public.benefits
ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'benefits_verification_status_check'
      AND conrelid = 'public.benefits'::regclass
  ) THEN
    ALTER TABLE public.benefits
    ADD CONSTRAINT benefits_verification_status_check
    CHECK (
      verification_status IN (
        'draft',
        'official',
        'archived'
      )
    );
  END IF;
END
$$;

COMMENT ON COLUMN public.benefits.verification_status IS
'Статус достоверности правил: draft — проект или неподтверждённые данные, official — подтверждено официальным источником, archived — устаревшие правила.';
