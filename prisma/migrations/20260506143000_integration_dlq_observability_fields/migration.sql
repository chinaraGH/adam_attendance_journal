ALTER TABLE public.integration_dlq
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_stack TEXT;

CREATE INDEX IF NOT EXISTS integration_dlq_last_error_at_idx
  ON public.integration_dlq(last_error_at);
