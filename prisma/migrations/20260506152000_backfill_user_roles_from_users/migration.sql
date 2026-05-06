INSERT INTO public.user_roles (
  id,
  user_id,
  role_code,
  source,
  is_active,
  deleted_at,
  created_at,
  updated_at
)
SELECT
  md5('seed_user_role_' || u.id || '_' || u.role),
  u.id,
  u.role,
  'legacy',
  true,
  NULL,
  now(),
  now()
FROM public.users u
WHERE u.is_active = true
  AND u.deleted_at IS NULL
ON CONFLICT (user_id, role_code, source) DO NOTHING;
