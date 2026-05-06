# Test Cases: Sync + UI Smoke

Минимальный набор проверок для закрытия PR-E (API integration + UI smoke).

## Перед запуском

- Приложение запущено и доступно по `SMOKE_BASE_URL` (например, `http://localhost:3000`).
- Заданы переменные:
  - `SMOKE_BASE_URL`
  - `SYNC_SECRET`
  - `CRON_SECRET`

## Команды

- `npm run test:integration:sync`
- `npm run test:smoke:ui`
- `npm run test:smoke:all`

## Что покрывается

### API Integration Smoke

Скрипт `scripts/tests/sync-integration-smoke.mjs` проверяет:

- `POST /api/sync/gaudi` (минимальный валидный payload).
- `POST /api/sync/schedule` (минимальный валидный payload).
- Идемпотентный повтор `POST /api/sync/schedule` с тем же `scheduleExternalId`.
- `POST /api/cron/reconcile-semesters` (ожидается `200` или `409` lock).
- `POST /api/cron/retry-integration-dlq`.
- `POST /api/cron/dlq-metrics`.

### UI Smoke

Скрипт `scripts/tests/ui-smoke.mjs` проверяет:

- Доступность страницы `/reports` и наличие признаков фильтрации "вне семестров".
- Доступность страницы `/acadepartment` и наличие блока аномалий/меток "вне семестров".

## Ожидаемый результат

- Оба скрипта завершаются с exit code `0`.
- В консоли печатается:
  - `Sync integration smoke tests passed.`
  - `UI smoke tests passed.`

## Ограничения

- Это smoke-набор, не заменяет полноценные unit/integration с изоляцией БД.
- Проверки UI выполняются по HTML и ключевым маркерам текста.
