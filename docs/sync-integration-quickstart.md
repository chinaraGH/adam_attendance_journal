# EJP Sync Quickstart

Короткая памятка для команд GAUDI и Schedule.

## База

- Base URL: `https://<your-host>`
- Auth (любой один):
  - `x-sync-token: <SYNC_SECRET>`
  - `Authorization: Bearer <SYNC_SECRET>`
- `Content-Type: application/json`

---

## 1) GAUDI → справочники

`POST /api/sync/gaudi`

### Обязательные поля

- `groups[]`: `gaudiId`, `name`
- `students[]`: `gaudiId`, `name`, `groupGaudiId`
- `teachers[]` (если передаёте): `gaudiId`, `name`

### Минимальный пример

```json
{
  "groups": [
    { "gaudiId": "G_IST_24", "name": "ИСТ-24" }
  ],
  "students": [
    { "gaudiId": "S_0001", "name": "Иванов Иван", "groupGaudiId": "G_IST_24" }
  ],
  "teachers": [
    { "gaudiId": "T_0001", "name": "Петров П.П." }
  ]
}
```

---

## 2) Schedule → занятия

`POST /api/sync/schedule`

### Обязательные поля

- `sessions[]`: `scheduleExternalId`, `groupGaudiId`, `disciplineCode`, `startTime`, `endTime`

### Важные правила идемпотентности

- В ЭЖП upsert идет по ключу `(source, scheduleExternalId)`.
- Для входящего Schedule API `source` фиксирован как `SCHEDULE` (задается на стороне ЭЖП).
- `semesterId` из входного payload игнорируется: семестр вычисляется внутри ЭЖП по `startTime`.

### Поля по преподавателю

- приоритет 1: `teacherId` (внутренний ID в EJP)
- приоритет 2: `teacherGaudiId`
- если преподавателя ещё нет: передайте `teacherGaudiId` + `teacherName` (создастся автоматически)

### Минимальный пример

```json
{
  "sessions": [
    {
      "scheduleExternalId": "SCH_2026_02_10_1",
      "groupGaudiId": "G_IST_24",
      "disciplineCode": "INF",
      "teacherGaudiId": "T_0001",
      "teacherName": "Петров П.П.",
      "startTime": "2026-02-10T08:00:00.000Z",
      "endTime": "2026-02-10T09:30:00.000Z"
    }
  ]
}
```

---

## Ответ API (оба endpoint)

```json
{
  "ok": true,
  "added": 10,
  "updated": 5,
  "errorsCount": 0,
  "errors": []
}
```

Если есть ошибки по отдельным записям, API всё равно вернёт `200`, но `ok: false` и детали в `errors[]`.

---

## Безопасные миграции и rollback

- Операционный runbook для down-plan и rollback без потери аудита: `docs/migration-safety-runbook.md`.
