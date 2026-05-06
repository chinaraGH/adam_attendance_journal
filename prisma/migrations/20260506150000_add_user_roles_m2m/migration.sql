CREATE TABLE IF NOT EXISTS public.user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  role_code TEXT NOT NULL,
  source TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_source_key
  ON public.user_roles(user_id, role_code, source);

CREATE INDEX IF NOT EXISTS user_roles_user_is_active_idx
  ON public.user_roles(user_id, is_active);

CREATE INDEX IF NOT EXISTS user_roles_source_idx
  ON public.user_roles(source);
