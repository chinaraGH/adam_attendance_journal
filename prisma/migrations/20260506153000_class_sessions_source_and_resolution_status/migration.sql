ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'SCHEDULE',
  ADD COLUMN IF NOT EXISTS semester_resolution_status TEXT;

UPDATE public.class_sessions
SET semester_resolution_status = CASE
  WHEN out_of_semester = true THEN 'OUT_OF_SEMESTER'
  WHEN semester_id IS NOT NULL THEN 'IN_SEMESTER'
  ELSE 'UNRESOLVED_ERROR'
END
WHERE semester_resolution_status IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'class_sessions_schedule_external_id_key'
      AND conrelid = 'public.class_sessions'::regclass
  ) THEN
    ALTER TABLE public.class_sessions
      DROP CONSTRAINT class_sessions_schedule_external_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS class_sessions_source_schedule_external_id_key
  ON public.class_sessions(source, schedule_external_id);
