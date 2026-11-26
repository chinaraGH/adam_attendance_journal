-- Тестовые данные: оставить только семестр «Весна 2026», остальные удалить (по просьбе Учебной части,
-- чтобы заново проверить создание семестра). Выполняется один раз при сборке.
-- Безопасность: техкарты других семестров удаляются только если в них нет оценок (control_scores);
-- семестр, на который остаётся ссылка, не удаляется.
DO $$
DECLARE
  keep_id text;
BEGIN
  SELECT "id" INTO keep_id FROM "semesters" WHERE "name" = 'Весна 2026' ORDER BY "created_at" LIMIT 1;
  IF keep_id IS NULL THEN
    RETURN;
  END IF;

  -- Даты оставшегося семестра: 01.02.2026 - 01.07.2026.
  UPDATE "semesters"
  SET "start_date" = TIMESTAMPTZ '2026-02-01 00:00:00+00',
      "end_date"   = TIMESTAMPTZ '2026-07-01 00:00:00+00'
  WHERE "id" = keep_id;

  -- Отметки удаляемых семестров привязываем к оставшемуся.
  UPDATE "attendances" SET "semester_id" = keep_id WHERE "semester_id" <> keep_id;

  -- Занятия вне дат оставшегося семестра остаются без семестра; их снова распределит создание нового семестра.
  UPDATE "class_sessions"
  SET "semester_id" = NULL, "out_of_semester" = true, "semester_resolution_status" = 'OUT_OF_SEMESTER'
  WHERE "semester_id" IS NOT NULL
    AND ("start_time" < TIMESTAMPTZ '2026-02-01 00:00:00+00' OR "start_time" > TIMESTAMPTZ '2026-07-01 00:00:00+00');

  -- Техкарты других семестров без оценок.
  DELETE FROM "tech_cards" t
  WHERE t."semester_id" <> keep_id
    AND NOT EXISTS (SELECT 1 FROM "control_scores" c WHERE c."tech_card_id" = t."id");

  -- Сами лишние семестры.
  DELETE FROM "semesters" s
  WHERE s."id" <> keep_id
    AND NOT EXISTS (SELECT 1 FROM "tech_cards" t WHERE t."semester_id" = s."id")
    AND NOT EXISTS (SELECT 1 FROM "attendances" a WHERE a."semester_id" = s."id");
END $$;
