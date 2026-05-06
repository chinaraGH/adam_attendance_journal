import assert from "node:assert/strict";

const baseUrl = process.env.SMOKE_BASE_URL;
const syncSecret = process.env.SYNC_SECRET;
const cronSecret = process.env.CRON_SECRET;

if (!baseUrl || !syncSecret || !cronSecret) {
  throw new Error("Set SMOKE_BASE_URL, SYNC_SECRET and CRON_SECRET env vars before running smoke tests.");
}

const headers = {
  "content-type": "application/json",
  "x-sync-token": syncSecret,
};

async function postJson(path, body, extraHeaders = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function postCron(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "x-cron-secret": cronSecret },
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function run() {
  const groupGaudiId = `SMOKE_GROUP_${Date.now()}`;
  const teacherGaudiId = `SMOKE_TEACHER_${Date.now()}`;
  const studentGaudiId = `SMOKE_STUDENT_${Date.now()}`;
  const scheduleExternalId = `SMOKE_SCHEDULE_${Date.now()}`;
  const now = new Date();
  const end = new Date(now.getTime() + 90 * 60 * 1000);

  const gaudiRes = await postJson("/api/sync/gaudi", {
    groups: [{ gaudiId: groupGaudiId, name: "SMOKE-ГРУППА" }],
    students: [{ gaudiId: studentGaudiId, name: "Смок Студент", groupGaudiId }],
    teachers: [{ gaudiId: teacherGaudiId, name: "Смок Преподаватель", email: "smoke.teacher@example.com" }],
  });
  assert.equal(gaudiRes.response.status, 200, "GAUDI sync should return 200");
  assert.equal(typeof gaudiRes.json.ok, "boolean", "GAUDI response should contain ok");

  const scheduleRes = await postJson("/api/sync/schedule", {
    sessions: [
      {
        scheduleExternalId,
        groupGaudiId,
        disciplineCode: "INF",
        teacherGaudiId,
        teacherName: "Смок Преподаватель",
        startTime: now.toISOString(),
        endTime: end.toISOString(),
        status: "scheduled",
      },
    ],
  });
  assert.equal(scheduleRes.response.status, 200, "Schedule sync should return 200");
  assert.equal(typeof scheduleRes.json.ok, "boolean", "Schedule response should contain ok");
  assert.equal(typeof scheduleRes.json.correlationId, "string", "Schedule response should contain correlationId");

  // Idempotency check: second call with same external id should not fail.
  const scheduleRetryRes = await postJson("/api/sync/schedule", {
    sessions: [
      {
        scheduleExternalId,
        groupGaudiId,
        disciplineCode: "INF",
        teacherGaudiId,
        teacherName: "Смок Преподаватель",
        startTime: now.toISOString(),
        endTime: end.toISOString(),
        status: "scheduled",
      },
    ],
  });
  assert.equal(scheduleRetryRes.response.status, 200, "Schedule idempotent retry should return 200");
  assert.equal(typeof scheduleRetryRes.json.ok, "boolean", "Schedule retry response should contain ok");

  const reconcileRes = await postCron("/api/cron/reconcile-semesters");
  assert.ok([200, 409].includes(reconcileRes.response.status), "Reconcile should return 200 or 409 when locked");

  const dlqRetryRes = await postCron("/api/cron/retry-integration-dlq");
  assert.equal(dlqRetryRes.response.status, 200, "DLQ retry should return 200");
  assert.equal(typeof dlqRetryRes.json.ok, "boolean", "DLQ retry response should contain ok");

  const dlqMetricsRes = await postCron("/api/cron/dlq-metrics");
  assert.equal(dlqMetricsRes.response.status, 200, "DLQ metrics should return 200");
  assert.equal(typeof dlqMetricsRes.json.total, "number", "DLQ metrics should contain total");

  console.log("Sync integration smoke tests passed.");
}

run().catch((error) => {
  console.error("Sync integration smoke tests failed:", error);
  process.exit(1);
});
