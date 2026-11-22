
BEGIN;

ALTER TABLE public.benefits
ADD COLUMN IF NOT EXISTS confirm_exam_subject text;

ALTER TABLE public.benefits
ALTER COLUMN level_required DROP NOT NULL;

ALTER TABLE public.benefits
DROP CONSTRAINT IF EXISTS benefits_level_valid;

ALTER TABLE public.benefits
ADD CONSTRAINT benefits_level_valid
CHECK (
  level_required IS NULL
  OR level_required BETWEEN 1 AND 4
);

ALTER TABLE public.benefits
DROP CONSTRAINT IF EXISTS benefits_confirm_exam_subject_not_empty;

ALTER TABLE public.benefits
ADD CONSTRAINT benefits_confirm_exam_subject_not_empty
CHECK (
  confirm_exam_subject IS NULL
  OR length(trim(confirm_exam_subject)) > 0
);

COMMENT ON COLUMN public.benefits.confirm_exam_subject IS
'Предмет ЕГЭ или вступительного испытания, по которому требуется подтвердить результат олимпиады.';

COMMENT ON COLUMN public.benefits.level_required IS
'Требуемый уровень олимпиады РСОШ. NULL используется, когда классификация неприменима или не установлена.';

COMMIT;
