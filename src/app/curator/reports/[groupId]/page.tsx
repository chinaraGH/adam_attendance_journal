import Link from "next/link";
import { performance } from "node:perf_hooks";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ExportCsvButton } from "@/components/export-csv-button";

function fmtShort(d: Date) {
  return new Date(d).toLocaleDateString("ru-RU", { month: "2-digit", day: "2-digit" });
}

function fmtTime(d: Date) {
  return new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default async function CuratorGroupReportPage(props: { params: { groupId: string } }) {
  const t0 = performance.now();
  const actor = await getCurrentUser();
  if (actor.role !== "CURATOR") {
    return (
      <main className="mx-auto max-w-[1200px] p-6">
        <h1 className="text-2xl font-black">Отчет по группе</h1>
        <p className="mt-3 text-sm text-gray-600">Недостаточно прав.</p>
        <p className="mt-3">
          <Link className="font-bold underline" href="/curator/dashboard">
            ← Назад
          </Link>
        </p>
      </main>
    );
  }

  const groupId = props.params.groupId;

  const link = await prisma.userGroupCurator.findFirst({
    where: { userId: actor.id, groupId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!link) {
    return (
      <main className="mx-auto max-w-[1200px] p-6">
        <h1 className="text-2xl font-black">Отчет по группе</h1>
        <p className="mt-3 text-sm text-gray-600">Нет доступа к группе.</p>
      </main>
    );
  }

  const group = await prisma.group.findFirst({
    where: { id: groupId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!group) {
    return (
      <main className="mx-auto max-w-[1200px] p-6">
        <h1 className="text-2xl font-black">Отчет по группе</h1>
        <p className="mt-3 text-sm text-gray-600">Группа не найдена.</p>
      </main>
    );
  }

  // Берем текущий (не locked) семестр, иначе самый последний.
  const semester =
    (await prisma.semester.findFirst({
      where: { isLocked: false },
      orderBy: { startDate: "desc" },
      select: { id: true, startDate: true, endDate: true, isLocked: true },
    })) ??
    (await prisma.semester.findFirst({
      orderBy: { startDate: "desc" },
      select: { id: true, startDate: true, endDate: true, isLocked: true },
    }));

  const sessions =
    semester?.id
      ? await prisma.classSession.findMany({
          where: {
            groupId,
            semesterId: semester.id,
            isActive: true,
            deletedAt: null,
            NOT: [{ statusV2: "cancelled" }, { status: "cancelled" }],
          },
          orderBy: { startTime: "asc" },
          take: 20,
          select: {
            id: true,
            startTime: true,
            endTime: true,
            discipline: { select: { name: true, code: true } },
          },
        })
      : [];

  const students = await prisma.student.findMany({
    where: { groupId, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const sessionIds = sessions.map((s) => s.id);
  const attendance =
    sessionIds.length === 0 || students.length === 0
      ? []
      : await prisma.attendance.findMany({
          where: {
            classSessionId: { in: sessionIds },
            studentId: { in: students.map((s) => s.id) },
            isActive: true,
            deletedAt: null,
          },
          select: { studentId: true, classSessionId: true, statusV2: true, status: true },
        });

  const t1 = performance.now();
  console.log(`[SLA] curator report groupId=${groupId} db_ms=${Math.round((t1 - t0) * 10) / 10}`);

  const cell = new Map<string, string>();
  for (const a of attendance) {
    const st = (a.statusV2 ?? a.status ?? "").trim().toUpperCase();
    cell.set(`${a.studentId}:${a.classSessionId}`, st);
  }

  const totalSessions = sessions.length;

  // Dynamics: last 4 weeks (including current). Week windows are [now-7d..now), etc.
  const now = new Date();
  const weekRanges = Array.from({ length: 4 }).map((_, i) => {
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { label: `Неделя ${4 - i}`, start, end };
  });

  const sessions28 = await prisma.classSession.findMany({
    where: {
      groupId,
      isActive: true,
      deletedAt: null,
      startTime: { gte: weekRanges[3]!.start, lte: weekRanges[0]!.end },
      NOT: [{ statusV2: "cancelled" }, { status: "cancelled" }],
    },
    select: { id: true, startTime: true },
  });
  const sessionIds28 = sessions28.map((s) => s.id);
  const att28 =
    sessionIds28.length === 0
      ? []
      : await prisma.attendance.findMany({
          where: { classSessionId: { in: sessionIds28 }, isActive: true, deletedAt: null, statusV2: { not: null } },
          select: { classSessionId: true, statusV2: true },
        });
  const sessionStartById = new Map(sessions28.map((s) => [s.id, s.startTime]));
  const weekly = weekRanges.map((w) => {
    let denom = 0;
    let numer = 0;
    for (const a of att28) {
      const st = (a.statusV2 ?? "").toUpperCase();
      const stime = sessionStartById.get(a.classSessionId);
      if (!stime) continue;
      if (stime < w.start || stime > w.end) continue;
      denom += 1;
      if (st === "P" || st === "O") numer += 1;
    }
    const pct = denom > 0 ? Math.round((numer / denom) * 1000) / 10 : 0;
    return { label: w.label, pct };
  });

  return (
    <main className="mx-auto max-w-[1200px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Отчет куратора • {group.name}</h1>
          <div className="mt-1 text-sm text-gray-600">
            Формула: % = (П + О) / всего занятий (по выбранным столбцам)
          </div>
        </div>
        <Link className="font-bold underline" href="/curator/dashboard">
          ← Dashboard
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-600">Официальная ведомость (временно CSV)</div>
        <ExportCsvButton
          filename={`curator-report-${groupId}.csv`}
          rows={students.map((s) => ({ studentId: s.id, studentName: s.name }))}
        />
      </div>

      <div className="mt-4 rounded-xl border bg-white p-4">
        <div className="font-black">Динамика посещаемости (последние 4 недели)</div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="px-3 py-2 font-black">Период</th>
                <th className="px-3 py-2 font-black">% (П+О)</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((w) => (
                <tr key={w.label} className="border-b last:border-b-0">
                  <td className="px-3 py-2 font-bold">{w.label}</td>
                  <td className="px-3 py-2 font-black">{w.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="sticky left-0 z-10 bg-white px-3 py-2 font-black">Студент</th>
                <th className="bg-white px-3 py-2 font-black">% (П+О)</th>
                {sessions.map((s) => {
                  const title = `${fmtShort(s.startTime)} ${fmtTime(s.startTime)}-${fmtTime(s.endTime)} ${s.discipline.code ?? ""}`;
                  return (
                    <th key={s.id} className="min-w-[140px] px-3 py-2 font-black">
                      <div className="leading-tight">{fmtShort(s.startTime)}</div>
                      <div className="text-xs text-gray-600">{s.discipline.code ?? "—"}</div>
                      <div className="text-xs text-gray-600">{fmtTime(s.startTime)}</div>
                      <div className="sr-only">{title}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {students.map((st) => {
                let attended = 0;
                for (const s of sessions) {
                  const v = cell.get(`${st.id}:${s.id}`) ?? "";
                  if (v === "P" || v === "О" || v === "O" || v === "П") attended += 1;
                }
                const pct = totalSessions > 0 ? Math.round((attended / totalSessions) * 1000) / 10 : 0;
                return (
                  <tr key={st.id} className="border-b last:border-b-0">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-bold">{st.name}</td>
                    <td className="px-3 py-2 font-black">{pct}%</td>
                    {sessions.map((s) => {
                      const v = cell.get(`${st.id}:${s.id}`) ?? "";
                      return (
                        <td key={s.id} className="px-3 py-2">
                          <span className="font-bold">{v || "—"}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-sm text-gray-600">
          Показано занятий: <span className="font-bold text-gray-900">{totalSessions}</span>
        </div>
      </div>
    </main>
  );
}

