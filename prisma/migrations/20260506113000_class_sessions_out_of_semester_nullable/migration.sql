ALTER TABLE public.class_sessions
  ALTER COLUMN semester_id DROP NOT NULL;

ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS out_of_semester BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_class_sessions_out_of_semester
  ON public.class_sessions(out_of_semester);
