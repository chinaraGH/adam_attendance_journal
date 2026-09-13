const fs = require('fs');
const path = require('path');
const files = [
  'src/lib/academic/build-acadepartment-charts.ts',
  'src/app/student/page.tsx',
  'src/app/curator/reports/[groupId]/page.tsx',
  'src/app/curator/dashboard/actions.ts',
  'src/app/curator/exemptions/[groupId]/page.tsx',
  'src/app/api/teacher/classes/route.ts',
  'src/app/api/student/discipline-options/route.ts',
  'src/app/admin/groups/[groupId]/page.tsx',
  'src/app/api/cron/process-sessions/route.ts'
];
for (let file of files) {
  const p = path.join(process.cwd(), file);
  let content = fs.readFileSync(p, 'utf8');
  content = content.split('NOT: [{ statusV2: "cancelled" }, { status: "cancelled" }]').join('OR: [{ statusV2: { not: "cancelled" } }, { statusV2: null, status: { not: "cancelled" } }]');
  fs.writeFileSync(p, content);
  console.log('Updated ' + file);
}
