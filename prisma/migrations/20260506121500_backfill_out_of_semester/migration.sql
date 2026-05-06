WITH resolved AS (
  SELECT
    cs.id,
    (
      SELECT s.id
      FROM public.semesters s
      WHERE s.start_date <= cs.start_time
        AND s.end_date >= cs.start_time
      ORDER BY s.start_date DESC
      LIMIT 1
    ) AS resolved_semester_id
  FROM public.class_sessions cs
),
to_update AS (
  SELECT
    r.id,
    r.resolved_semester_id,
    CASE WHEN r.resolved_semester_id IS NULL THEN true ELSE false END AS next_out_of_semester
  FROM resolved r
)
UPDATE public.class_sessions cs
SET
  semester_id = u.resolved_semester_id,
  out_of_semester = u.next_out_of_semester
FROM to_update u
WHERE cs.id = u.id
  AND (
    cs.semester_id IS DISTINCT FROM u.resolved_semester_id
    OR cs.out_of_semester IS DISTINCT FROM u.next_out_of_semester
  );

INSERT INTO public.audit_trail (
  id,
  created_at,
  actor_type,
  actor_id,
  action,
  entity_type,
  entity_id,
  before_json,
  after_json
)
SELECT
  md5('migration_backfill_out_of_semester_' || cs.id || now()::text),
  now(),
  'system',
  null,
  'migration_backfill_out_of_semester',
  'ClassSession',
  cs.id,
  null,
  json_build_object('semesterId', cs.semester_id, 'outOfSemester', cs.out_of_semester)::text
FROM public.class_sessions cs;
