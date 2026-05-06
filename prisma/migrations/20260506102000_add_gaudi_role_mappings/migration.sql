CREATE TABLE IF NOT EXISTS public.gaudi_role_mappings (
  id TEXT PRIMARY KEY,
  gaudi_role TEXT NOT NULL UNIQUE,
  ejp_role TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS gaudi_role_mappings_is_active_idx ON public.gaudi_role_mappings(is_active);
CREATE INDEX IF NOT EXISTS gaudi_role_mappings_priority_idx ON public.gaudi_role_mappings(priority);
