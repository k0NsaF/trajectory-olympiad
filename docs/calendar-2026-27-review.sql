-- Read-only audit query for the 2026/27 school olympiad calendar.
-- Run on STAGING (uzsossytdoysravlbgcp), export the second result set to CSV,
-- and verify each row against the linked organizer page before changing data.

-- 1) Coverage summary: shows how many rows are safe candidates for review vs. need remediation.
SELECT
  s.academic_year,
  o.list_type,
  si.kind,
  si.is_confirmed,
  si.date_parse_status,
  si.date_semantics,
  count(*) AS row_count,
  count(*) FILTER (WHERE coalesce(si.end_date, si.start_date) >= current_date) AS not_past_count,
  count(*) FILTER (WHERE si.checked_on >= current_date - 90) AS checked_within_90_days
FROM public.olympiad_schedule_items si
JOIN public.olympiads o ON o.id = si.olympiad_id
JOIN public.olympiad_seasons s ON s.olympiad_id = o.id
WHERE s.academic_year = '2026-2027'
  AND coalesce(s.list_type, o.list_type) = 'school_olympiad'
GROUP BY s.academic_year, o.list_type, si.kind, si.is_confirmed, si.date_parse_status, si.date_semantics
ORDER BY si.kind, si.is_confirmed DESC, si.date_parse_status, si.date_semantics;

-- 2) Row-level review queue. Do not treat a date as officially current until the organizer page is checked.
SELECT
  o.name AS olympiad_name,
  o.organizer,
  o.subjects AS mapped_subjects,
  o.grades AS olympiad_grade_range,
  s.grades AS season_grade_range,
  s.grade_eligibility_status AS season_grade_status,
  si.kind,
  si.stage_name,
  si.when_text,
  si.start_date,
  si.end_date,
  si.start_time,
  si.end_time,
  si.time_zone,
  si.is_confirmed,
  si.date_parse_status,
  si.date_semantics,
  si.checked_on,
  si.organizer_url,
  si.source_provider,
  CASE
    WHEN si.is_confirmed
      AND si.date_parse_status IN ('exact', 'range')
      AND si.date_semantics IN ('event', 'period', 'deadline')
      AND si.start_date IS NOT NULL
      AND si.end_date IS NOT NULL
      AND si.organizer_url LIKE 'https://%'
      AND si.checked_on >= current_date - 90
      AND coalesce(si.end_date, si.start_date) >= current_date
      THEN 'CANDIDATE: verify on organizer site'
    ELSE 'NEEDS REVIEW: do not schedule automatically'
  END AS review_status,
  NULL::text AS reviewer_result,
  NULL::text AS reviewer_notes
FROM public.olympiad_schedule_items si
JOIN public.olympiads o ON o.id = si.olympiad_id
JOIN public.olympiad_seasons s ON s.olympiad_id = o.id
WHERE s.academic_year = '2026-2027'
  AND coalesce(s.list_type, o.list_type) = 'school_olympiad'
ORDER BY si.start_date NULLS LAST, o.name, si.kind, si.order_n;
