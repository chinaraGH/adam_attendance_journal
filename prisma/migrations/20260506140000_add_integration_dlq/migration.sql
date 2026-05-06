CREATE TABLE IF NOT EXISTS public.integration_dlq (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  category TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS integration_dlq_provider_operation_idx
  ON public.integration_dlq(provider, operation);

CREATE INDEX IF NOT EXISTS integration_dlq_status_next_retry_at_idx
  ON public.integration_dlq(status, next_retry_at);

CREATE INDEX IF NOT EXISTS integration_dlq_correlation_id_idx
  ON public.integration_dlq(correlation_id);
