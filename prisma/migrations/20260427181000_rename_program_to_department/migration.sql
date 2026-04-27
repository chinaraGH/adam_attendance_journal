-- Rename Program model/table to Department.
-- This migration assumes PostgreSQL.

DO $$
BEGIN
  -- 1) Rename table if it exists
  IF to_regclass('public.programs') IS NOT NULL AND to_regclass('public.departments') IS NULL THEN
    EXECUTE 'ALTER TABLE public.programs RENAME TO departments';
  END IF;

  -- 2) Rename FK columns program_id -> department_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'program_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.groups RENAME COLUMN program_id TO department_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'disciplines' AND column_name = 'program_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.disciplines RENAME COLUMN program_id TO department_id';
  END IF;

  -- 3) Rename indexes that Prisma typically creates
  IF to_regclass('public.groups_program_id_idx') IS NOT NULL AND to_regclass('public.groups_department_id_idx') IS NULL THEN
    EXECUTE 'ALTER INDEX public.groups_program_id_idx RENAME TO groups_department_id_idx';
  END IF;

  IF to_regclass('public.disciplines_program_id_idx') IS NOT NULL AND to_regclass('public.disciplines_department_id_idx') IS NULL THEN
    EXECUTE 'ALTER INDEX public.disciplines_program_id_idx RENAME TO disciplines_department_id_idx';
  END IF;

  IF to_regclass('public.programs_code_key') IS NOT NULL AND to_regclass('public.departments_code_key') IS NULL THEN
    EXECUTE 'ALTER INDEX public.programs_code_key RENAME TO departments_code_key';
  END IF;

  IF to_regclass('public.programs_pkey') IS NOT NULL AND to_regclass('public.departments_pkey') IS NULL THEN
    EXECUTE 'ALTER INDEX public.programs_pkey RENAME TO departments_pkey';
  END IF;

  IF to_regclass('public.programs_faculty_id_idx') IS NOT NULL AND to_regclass('public.departments_faculty_id_idx') IS NULL THEN
    EXECUTE 'ALTER INDEX public.programs_faculty_id_idx RENAME TO departments_faculty_id_idx';
  END IF;

  -- 4) Ensure FK constraints are present with new names (drop/recreate only if old exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'departments' AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'programs_faculty_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.departments DROP CONSTRAINT programs_faculty_id_fkey';
    EXECUTE 'ALTER TABLE public.departments ADD CONSTRAINT departments_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculties(id) ON DELETE RESTRICT ON UPDATE CASCADE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'groups' AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'groups_program_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.groups DROP CONSTRAINT groups_program_id_fkey';
    EXECUTE 'ALTER TABLE public.groups ADD CONSTRAINT groups_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'disciplines' AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'disciplines_program_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.disciplines DROP CONSTRAINT disciplines_program_id_fkey';
    EXECUTE 'ALTER TABLE public.disciplines ADD CONSTRAINT disciplines_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

