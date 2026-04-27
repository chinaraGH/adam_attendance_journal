DO $$
BEGIN
  IF to_regclass('public.user_group_curators') IS NULL THEN
    EXECUTE $SQL$
      CREATE TABLE public.user_group_curators (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        group_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL,
        CONSTRAINT user_group_curators_user_group_key UNIQUE (user_id, group_id)
      );

      CREATE INDEX user_group_curators_user_id_idx ON public.user_group_curators(user_id);
      CREATE INDEX user_group_curators_group_id_idx ON public.user_group_curators(group_id);
      CREATE INDEX user_group_curators_is_active_idx ON public.user_group_curators(is_active);
      CREATE INDEX user_group_curators_deleted_at_idx ON public.user_group_curators(deleted_at);
    $SQL$;
  END IF;
END
$$;

