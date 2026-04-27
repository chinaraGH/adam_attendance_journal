SELECT
  to_regclass('public.departments') AS departments_table,
  to_regclass('public.programs') AS programs_table;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('groups', 'disciplines')
  AND column_name IN ('department_id', 'program_id')
ORDER BY table_name, column_name;

