ALTER TABLE public.benefits
ADD COLUMN IF NOT EXISTS result_class_required SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'benefits_result_class_required_check'
          AND conrelid = 'public.benefits'::regclass
    ) THEN
        ALTER TABLE public.benefits
        ADD CONSTRAINT benefits_result_class_required_check
        CHECK (
            result_class_required IS NULL
            OR result_class_required BETWEEN 7 AND 11
        );
    END IF;
END $$;

COMMENT ON COLUMN public.benefits.result_class_required IS
'Класс, за который должен быть получен олимпиадный результат';