import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ProblemGroupsClient } from "./problem-groups-client";

export default async function LeadershipDashboardPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "LEADERSHIP") {
    return (
      <main className="mx-auto max-w-[1200px] p-6">
        <h1 className="text-2xl font-black">Руководство</h1>
        <p className="mt-3 text-sm text-gray-600">Недостаточно прав.</p>
      </main>
    );
  }

  // Lowest attendance by discipline (university-wide): (P+O) / all non-null marks.
  const totalBySession = await prisma.attendance.groupBy({
    by: ["classSessionId"],
    where: { isActive: true, deletedAt: null, statusV2: { not: null } },
    _count: { _all: true },
  });

  const attendedBySession = await prisma.attendance.groupBy({
    by: ["classSessionId"],
    where: { isActive: true, deletedAt: null, statusV2: { in: ["P", "O"] } },
    _count: { _all: true },
  });

  const sessionIds = Array.from(new Set([...totalBySession.map((x) => x.classSessionId), ...attendedBySession.map((x) => x.classSessionId)]));
  const sessions = sessionIds.length
    ? await prisma.classSession.findMany({
        where: { id: { in: sessionIds }, isActive: true, deletedAt: null },
        select: { id: true, disciplineId: true, discipline: { select: { name: true, code: true } } },
      })
    : [];

  const sessionToDiscipline = new Map(sessions.map((s) => [s.id, s.disciplineId]));
  const disciplineInfo = new Map(sessions.map((s) => [s.disciplineId, { name: s.discipline.name, code: s.discipline.code }]));

  const denomByDiscipline = new Map<string, number>();
  for (const r of totalBySession) {
    const did = sessionToDiscipline.get(r.classSessionId);
    if (!did) continue;
    denomByDiscipline.set(did, (denomByDiscipline.get(did) ?? 0) + r._count._all);
  }

  const numerByDiscipline = new Map<string, number>();
  for (const r of attendedBySession) {
    const did = sessionToDiscipline.get(r.classSessionId);
    if (!did) continue;
    numerByDiscipline.set(did, (numerByDiscipline.get(did) ?? 0) + r._count._all);
  }

  const disciplineRows = Array.from(denomByDiscipline.entries())
    .map(([disciplineId, denom]) => {
      const numer = numerByDiscipline.get(disciplineId) ?? 0;
      const pct = denom > 0 ? Math.round((numer / denom) * 1000) / 10 : 0;
      const info = disciplineInfo.get(disciplineId);
      return { disciplineId, denom, attendancePct: pct, name: info?.name ?? disciplineId, code: info?.code ?? null };
    })
    .filter((r) => r.denom > 0)
    .sort((a, b) => a.attendancePct - b.attendancePct)
    .slice(0, 10);

  return (
    <main className="mx-auto max-w-[1200px] p-6">
      <div className="grid gap-4">
        <ProblemGroupsClient />

        <Card>
          <CardHeader>
            <CardTitle>Посещаемость по дисциплинам (ТОП-10 худших)</CardTitle>
          </CardHeader>
          <CardContent>
            {disciplineRows.length === 0 ? (
              <div className="text-sm text-gray-600">Нет данных.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Дисциплина</TableHead>
                      <TableHead>% (П+О)</TableHead>
                      <TableHead>Отметок</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disciplineRows.map((d, idx) => (
                      <TableRow key={d.disciplineId}>
                        <TableCell className="font-black">{idx + 1}</TableCell>
                        <TableCell className="font-black">
                          {d.name} <span className="text-xs text-gray-600">{d.code ?? ""}</span>
                        </TableCell>
                        <TableCell className="font-black">{d.attendancePct}%</TableCell>
                        <TableCell>{d.denom}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

