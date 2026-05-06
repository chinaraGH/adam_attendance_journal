import assert from "node:assert/strict";

const baseUrl = process.env.SMOKE_BASE_URL;

if (!baseUrl) {
  throw new Error("Set SMOKE_BASE_URL env var before running UI smoke tests.");
}

async function getHtml(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const html = await response.text();
  return { response, html };
}

async function run() {
  const reports = await getHtml("/reports");
  assert.equal(reports.response.status, 200, "/reports should be reachable");
  assert.ok(
    reports.html.includes("Вне семестров") || reports.html.includes("Только вне семестров"),
    "/reports should contain out-of-semester filters/counters",
  );

  const acadepartment = await getHtml("/acadepartment");
  assert.equal(acadepartment.response.status, 200, "/acadepartment should be reachable");
  assert.ok(
    acadepartment.html.includes("Аномалии расписания") || acadepartment.html.includes("Вне семестров"),
    "/acadepartment should contain anomaly or out-of-semester indicators",
  );

  console.log("UI smoke tests passed.");
}

run().catch((error) => {
  console.error("UI smoke tests failed:", error);
  process.exit(1);
});
