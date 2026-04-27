-- Split Department (кафедра) and Program (направление), add DisciplineProgram M2M.
-- WARNING: this migration is written for PostgreSQL.
-- It is designed to be safe on an empty-ish prototype DB (except `users`),
-- by dropping and recreating academic structure tables.

DO $$
BEGIN
  -- Drop dependent tables first (except users).
  IF to_regclass('public.attendances') IS NOT NULL THEN EXECUTE 'DROP TABLE public.attendances CASCADE'; END IF;
  IF to_regclass('public.class_sessions') IS NOT NULL THEN EXECUTE 'DROP TABLE public.class_sessions CASCADE'; END IF;
  IF to_regclass('public.students') IS NOT NULL THEN EXECUTE 'DROP TABLE public.students CASCADE'; END IF;
  IF to_regclass('public.user_group_curators') IS NOT NULL THEN EXECUTE 'DROP TABLE public.user_group_curators CASCADE'; END IF;
  IF to_regclass('public.discipline_programs') IS NOT NULL THEN EXECUTE 'DROP TABLE public.discipline_programs CASCADE'; END IF;
  IF to_regclass('public.disciplines') IS NOT NULL THEN EXECUTE 'DROP TABLE public.disciplines CASCADE'; END IF;
  IF to_regclass('public.groups') IS NOT NULL THEN EXECUTE 'DROP TABLE public.groups CASCADE'; END IF;
  IF to_regclass('public.programs') IS NOT NULL THEN EXECUTE 'DROP TABLE public.programs CASCADE'; END IF;
  IF to_regclass('public.departments') IS NOT NULL THEN EXECUTE 'DROP TABLE public.departments CASCADE'; END IF;
  IF to_regclass('public.teachers') IS NOT NULL THEN EXECUTE 'DROP TABLE public.teachers CASCADE'; END IF;
  IF to_regclass('public.integration_logs') IS NOT NULL THEN EXECUTE 'DROP TABLE public.integration_logs CASCADE'; END IF;
  IF to_regclass('public.audit_trail') IS NOT NULL THEN EXECUTE 'DROP TABLE public.audit_trail CASCADE'; END IF;
  IF to_regclass('public.semesters') IS NOT NULL THEN EXECUTE 'DROP TABLE public.semesters CASCADE'; END IF;
  IF to_regclass('public.faculties') IS NOT NULL THEN EXECUTE 'DROP TABLE public.faculties CASCADE'; END IF;

  -- Recreate tables according to current Prisma schema.
  EXECUTE $SQL$
    CREATE TABLE public.faculties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT true,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE public.departments (
      id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL REFERENCES public.faculties(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      name TEXT NOT NULL,
      code TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT departments_faculty_id_name_key UNIQUE (faculty_id, name)
    );

    CREATE TABLE public.programs (
      id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL REFERENCES public.faculties(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      department_id TEXT NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      name TEXT NOT NULL,
      code TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT programs_faculty_department_name_key UNIQUE (faculty_id, department_id, name)
    );

    CREATE TABLE public.groups (
      id TEXT PRIMARY KEY,
      gaudi_id TEXT NOT NULL UNIQUE,
      program_id TEXT REFERENCES public.programs(id) ON DELETE SET NULL ON UPDATE CASCADE,
      name TEXT NOT NULL,
      code TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT groups_program_code_key UNIQUE (program_id, code)
    );

    CREATE TABLE public.students (
      id TEXT PRIMARY KEY,
      gaudi_id TEXT NOT NULL UNIQUE,
      group_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE public.teachers (
      id TEXT PRIMARY KEY,
      gaudi_id TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE public.semesters (
      id TEXT PRIMARY KEY,
      name TEXT,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL,
      is_locked BOOLEAN NOT NULL DEFAULT false,
      locked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE public.disciplines (
      id TEXT PRIMARY KEY,
      department_id TEXT REFERENCES public.departments(id) ON DELETE SET NULL ON UPDATE CASCADE,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT true,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT disciplines_department_name_key UNIQUE (department_id, name)
    );

    CREATE TABLE public.discipline_programs (
      id TEXT PRIMARY KEY,
      discipline_id TEXT NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      program_id TEXT NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT discipline_programs_discipline_program_key UNIQUE (discipline_id, program_id)
    );

    CREATE TABLE public.class_sessions (
      id TEXT PRIMARY KEY,
      schedule_external_id TEXT NOT NULL UNIQUE,
      gaudi_id TEXT UNIQUE,
      discipline_id TEXT NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      group_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      teacher_id TEXT NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      semester_id TEXT NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      status_v2 TEXT,
      opened_at TIMESTAMPTZ,
      flag_late_teacher BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE public.attendances (
      id TEXT PRIMARY KEY,
      class_session_id TEXT NOT NULL REFERENCES public.class_sessions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      semester_id TEXT NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      status TEXT,
      status_v2 TEXT,
      gaudi_id TEXT UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT true,
      deleted_at TIMESTAMPTZ,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT attendances_class_session_id_student_id_key UNIQUE (class_session_id, student_id)
    );

    CREATE TABLE public.integration_logs (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      details JSONB
    );

    CREATE TABLE public.audit_trail (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT
    );

    -- Representative indexes (subset; Prisma will manage in app-level usage)
    CREATE INDEX groups_program_id_idx ON public.groups(program_id);
    CREATE INDEX students_group_id_idx ON public.students(group_id);
    CREATE INDEX disciplines_department_id_idx ON public.disciplines(department_id);
    CREATE INDEX discipline_programs_program_id_idx ON public.discipline_programs(program_id);
    CREATE INDEX discipline_programs_discipline_id_idx ON public.discipline_programs(discipline_id);
  $SQL$;
END $$;

