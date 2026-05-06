# Migration Safety Runbook (EJP Sync)

Runbook для выполнения миграций и rollback/down-plan без потери `audit_trail`.

## Scope

- Интеграционные миграции GAUDI/Schedule.
- Таблицы: `class_sessions`, `integration_dlq`, `gaudi_role_mappings`, `user_roles`.
- Критично сохранить: `audit_trail`, `integration_logs`, `integration_dlq`.

## Принципы безопасности

- Никогда не удалять (`DROP`/`TRUNCATE`) `audit_trail`.
- Rollback выполняется как **forward-fix** (добавляем/переключаем совместимые структуры), а не destructive revert.
- До миграции обязательно окно заморозки sync-входа и snapshot backup.
- Любой down-plan сначала на staging с копией production-данных.

## Pre-flight checklist

1. Зафиксировать релизную версию и текущий commit SHA.
2. Включить maintenance/freeze для:
   - `POST /api/sync/gaudi`
   - `POST /api/sync/schedule`
   - cron retry/reconcile endpoints.
3. Снять backup:
   - минимум логический dump затронутых таблиц;
   - рекомендуется PITR/physical snapshot.
4. Проверить, что очереди пустые или ожидаемо стабилизированы:
   - `integration_dlq` по статусам `pending/retrying/dead`.
5. Подготовить SQL для rollback заранее (dry-run на staging).

## Безопасный порядок миграции (up)

1. Сначала additive-изменения:
   - новые колонки nullable/with defaults;
   - новые индексы/уникальные ключи.
2. Затем backfill в батчах.
3. Затем переключение кода (feature switch / deploy).
4. Только после подтверждения стабильности удалять legacy-констрейнты.

## Down-plan / Rollback Strategy

> Цель: вернуть работоспособность приложения, не потеряв аудит и историю интеграций.

### 1) Application rollback first

- Откатить приложение до последнего стабильного релиза (без изменения данных).
- Сохранять read-only доступ к историческим данным.

### 2) DB compatibility bridge (если требуется)

Если приложение ожидает старый ключ в `class_sessions`, а в БД уже новый `(source, schedule_external_id)`:

1. Убедиться, что дубликатов `schedule_external_id` между источниками нет:

```sql
SELECT schedule_external_id, COUNT(*) AS c
FROM class_sessions
GROUP BY schedule_external_id
HAVING COUNT(*) > 1;
```

2. Если результат пустой, добавить legacy-unique индекс обратно:

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS class_sessions_schedule_external_id_key_legacy
  ON class_sessions(schedule_external_id);
```

3. Не удалять новый composite-ключ, пока не завершен инцидент и анализ.

### 3) Необратимые/опасные действия запрещены во время инцидента

- Нельзя `DROP TABLE audit_trail`.
- Нельзя `TRUNCATE integration_logs`/`integration_dlq` без отдельного утверждения.
- Нельзя удалять столбцы, используемые для расследования (`correlation_id`, `last_error_at`, `last_error_stack`).

### 4) Data preservation fallback

Если требуется срочный rollback схемы:

- создать shadow-таблицы с копией данных (`CREATE TABLE ... AS SELECT ...`);
- только после этого применять DDL-откат;
- хранить snapshot до закрытия инцидента.

## Post-rollback validation

1. `prisma validate` и smoke `tsc --noEmit` на rollback-ветке.
2. Проверить API health:
   - `/api/sync/gaudi`
   - `/api/sync/schedule`
3. Проверить консистентность:
   - новые записи в `integration_logs` создаются;
   - `audit_trail` продолжает пополняться;
   - `integration_dlq` retry-процесс работает.
4. Снять freeze только после успешной валидации.

## Recovery после инцидента

1. Собрать RCA: причина, таймлайн, blast radius.
2. Восстановить целевой forward-путь (новая миграция fix-up, не destructive rollback).
3. Обновить этот runbook конкретными SQL-скриптами по инциденту.

## Минимальный rollback артефакт (обязательно хранить)

- Commit SHA приложения до/после.
- Список примененных миграций.
- Файл pre-check результатов SQL.
- Идентификатор backup/snapshot.
- Время freeze on/off.
