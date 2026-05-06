import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { formatDisciplineLabel } from "@/lib/ui/labels";
import { AutoSubmitDateInput, AutoSubmitDisciplineMultiSelect, AutoSubmitSelect } from "./auto-submit-filters";
import { getCanonicalAttendanceStatusV2 } from "@/lib/attendance/status-machine";

const LOW_ATTENDANCE_THRESHOLD = 70;

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toSingleParam(param: string | string[] | undefined): string | undefined {
  if (!param) return undefined;
  if (Array.isArray(param)) {
    const first = param.find(Boolean);
    return first?.trim() || undefined;
  }
  const value = param.trim();
  return value || undefined;
}

function parseDate(param: string | string[] | undefined): Date | null {
  const value = toSingleParam(param);
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, monthIndex, day);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== monthIndex ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function toStartOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toEndOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toArray(value?: string | string[]) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

export default async function ReportsPage(props: {
  searchParams: { groupId?: string; disciplineId?: string | string[]; from?: string | string[]; to?: string | string[]; semesterScope?: string };
}) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "TEACHER" && actor.role !== "CURATOR") {
    return (
      <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Отчеты</h1>
        <p style={{ marginTop: 12 }}>Недостаточно прав.</p>
      </main>
    );
  }

  const groups = await prisma.group.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const defaultGroupId = groups[0]?.id ?? "";
  const groupId = props.searchParams.groupId ?? defaultGroupId;

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = new Date(now);
  defaultTo.setHours(23, 59, 59, 999);

  const from = toStartOfDay(parseDate(props.searchParams.from) ?? defaultFrom);
  const to = toEndOfDay(parseDate(props.searchParams.to) ?? defaultTo);

  const disciplines = groupId
    ? await prisma.classSession.findMany({
        where: { groupId, isActive: true, deletedAt: null, startTime: { gte: from, lte: to } },
        distinct: ["disciplineId"],
        select: { disciplineId: true },
        orderBy: { disciplineId: "asc" },
      })
    : [];
  const disciplineNameById = new Map(
    (
      disciplines.length === 0
        ? []
        : await prisma.discipline.findMany({
            where: { id: { in: disciplines.map((d) => d.disciplineId) }, isActive: true, deletedAt: null },
            select: { id: true, name: true },
          })
    ).map((d) => [d.id, d.name]),
  );
  const selectedDisciplineIds = toArray(props.searchParams.disciplineId);
  const availableDisciplineIds = new Set(disciplines.map((d) => d.disciplineId));
  const disciplineIds = selectedDisciplineIds.filter((id) => availableDisciplineIds.has(id));
  const semesterScopeParam = toSingleParam(props.searchParams.semesterScope) ?? "all";
  const semesterScope: "all" | "in" | "out" =
    semesterScopeParam === "in" || semesterScopeParam === "out" ? semesterScopeParam : "all";

  const students =
    groupId.length > 0
      ? await prisma.student.findMany({
          where: { groupId, isActive: true, deletedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [];

  const sessions =
    groupId.length > 0
      ? await prisma.classSession.findMany({
          where: {
            groupId,
            isActive: true,
            deletedAt: null,
            startTime: { gte: from, lte: to },
            ...(semesterScope === "in" ? { outOfSemester: false } : {}),
            ...(semesterScope === "out" ? { outOfSemester: true } : {}),
            ...(disciplineIds.length > 0 ? { disciplineId: { in: disciplineIds } } : {}),
          },
          select: { id: true, disciplineId: true, outOfSemester: true },
        })
      : [];

  const sessionIds = sessions.map((s) => s.id);
  const sessionDisciplineById = new Map(sessions.map((s) => [s.id, s.disciplineId]));
  const totalSessions = sessionIds.length;
  const outOfSemesterSessions = sessions.filter((s) => s.outOfSemester).length;

  const attendanceRows =
    sessionIds.length === 0 || students.length === 0
      ? []
      : await prisma.attendance.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            classSessionId: { in: sessionIds },
            studentId: { in: students.map((s) => s.id) },
          },
          select: { studentId: true, classSessionId: true, statusV2: true, status: true },
        });

  const byStudent = new Map<string, { NB: number; O: number; P: number }>();
  for (const s of students) byStudent.set(s.id, { NB: 0, O: 0, P: 0 });
  for (const r of attendanceRows) {
    const rec = byStudent.get(r.studentId) ?? { NB: 0, O: 0, P: 0 };
    const st = (getCanonicalAttendanceStatusV2({ statusV2: r.statusV2, status: r.status }) ?? "").toUpperCase();
    if (st === "NB") rec.NB += 1;
    if (st === "O") rec.O += 1;
    if (st === "P") rec.P += 1;
    byStudent.set(r.studentId, rec);
  }

  const rows = students.map((s) => {
    const c = byStudent.get(s.id) ?? { NB: 0, O: 0, P: 0 };
    const pct = totalSessions > 0 ? Math.round(((c.P + c.O) / totalSessions) * 1000) / 10 : 0;
    return { studentId: s.id, studentName: s.name, nb: c.NB, o: c.O, pct };
  });

  const selectedDisciplineSet = new Set(disciplineIds);
  const disciplineOrder: string[] =
    disciplineIds.length > 0
      ? disciplineIds
      : disciplines
          .map((d) => d.disciplineId)
          .filter((id) =>
            sessions.some((s) => s.disciplineId === id) &&
            (selectedDisciplineSet.size === 0 || selectedDisciplineSet.has(id)),
          );

  const sessionsCountByDiscipline = new Map<string, number>();
  for (const s of sessions) {
    sessionsCountByDiscipline.set(s.disciplineId, (sessionsCountByDiscipline.get(s.disciplineId) ?? 0) + 1);
  }

  const byStudentDiscipline = new Map<string, { NB: number; O: number; P: number }>();
  for (const r of attendanceRows) {
    const discipline = sessionDisciplineById.get(r.classSessionId);
    if (!discipline) continue;
    const key = `${r.studentId}:${discipline}`;
    const rec = byStudentDiscipline.get(key) ?? { NB: 0, O: 0, P: 0 };
    const st = (getCanonicalAttendanceStatusV2({ statusV2: r.statusV2, status: r.status }) ?? "").toUpperCase();
    if (st === "NB") rec.NB += 1;
    if (st === "O") rec.O += 1;
    if (st === "P") rec.P += 1;
    byStudentDiscipline.set(key, rec);
  }

  const disciplineSections = disciplineOrder.map((disciplineId) => {
    const total = sessionsCountByDiscipline.get(disciplineId) ?? 0;
    const disciplineRows = students.map((s) => {
      const c = byStudentDiscipline.get(`${s.id}:${disciplineId}`) ?? { NB: 0, O: 0, P: 0 };
      const pct = total > 0 ? Math.round(((c.P + c.O) / total) * 1000) / 10 : 0;
      return { studentId: s.id, studentName: s.name, nb: c.NB, o: c.O, pct };
    });
    return { disciplineId, totalSessions: total, rows: disciplineRows };
  });

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Отчеты</h1>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Фильтры</div>
        <form method="get" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Группа
            <AutoSubmitSelect name="groupId" defaultValue={groupId}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </AutoSubmitSelect>
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Дисциплина
            <AutoSubmitDisciplineMultiSelect
              name="disciplineId"
              selectedValues={disciplineIds}
              options={disciplines.map((d) => ({
                value: d.disciplineId,
                label: formatDisciplineLabel({
                  disciplineId: d.disciplineId,
                  disciplineName: disciplineNameById.get(d.disciplineId) ?? null,
                }),
              }))}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            С
            <AutoSubmitDateInput name="from" defaultValue={toDateInputValue(from)} />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            По
            <AutoSubmitDateInput name="to" defaultValue={toDateInputValue(to)} />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Область семестра
            <AutoSubmitSelect name="semesterScope" defaultValue={semesterScope}>
              <option value="all">Все</option>
              <option value="in">Только в семестре</option>
              <option value="out">Только вне семестров</option>
            </AutoSubmitSelect>
          </label>
        </form>
        <div style={{ marginTop: 10, color: "#6b7280", fontWeight: 700 }}>
          Формула: % = (П + О) / всего занятий за период • Порог: {LOW_ATTENDANCE_THRESHOLD}%
        </div>
        <div style={{ marginTop: 6, color: outOfSemesterSessions > 0 ? "#92400e" : "#6b7280", fontWeight: 700 }}>
          Вне семестров в текущей выборке: {outOfSemesterSessions}
        </div>
      </div>

      <div style={{ marginTop: 16, fontWeight: 900, fontSize: 16 }}>1. Общий результат по выбранным предметам</div>
      <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 14, background: "white", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "10px 8px" }}>Студент</th>
              <th style={{ padding: "10px 8px" }}>НБ</th>
              <th style={{ padding: "10px 8px" }}>О</th>
              <th style={{ padding: "10px 8px" }}>Итого %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isLow = r.pct < LOW_ATTENDANCE_THRESHOLD;
              return (
                <tr key={r.studentId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 900 }}>{r.studentName}</td>
                  <td style={{ padding: "10px 8px" }}>{r.nb}</td>
                  <td style={{ padding: "10px 8px" }}>{r.o}</td>
                  <td style={{ padding: "10px 8px", fontWeight: 900, color: isLow ? "#dc2626" : "#111827" }}>
                    {r.pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: 12, color: "#6b7280" }}>
          Всего занятий за период: <span style={{ fontWeight: 900 }}>{totalSessions}</span>
        </div>
      </div>

      <div style={{ marginTop: 20, fontWeight: 900, fontSize: 16 }}>2. Результаты по каждому предмету отдельно</div>
      {disciplineSections.length === 0 ? (
        <div style={{ marginTop: 8, color: "#6b7280", fontWeight: 700 }}>Нет дисциплин для выбранных фильтров.</div>
      ) : (
        disciplineSections.map((section) => (
          <div key={section.disciplineId} style={{ marginTop: 10, border: "1px solid #e5e7eb", borderRadius: 14, background: "white", overflowX: "auto" }}>
            <div style={{ padding: 12, fontWeight: 900 }}>
              {formatDisciplineLabel({
                disciplineId: section.disciplineId,
                disciplineName: disciplineNameById.get(section.disciplineId) ?? null,
              })}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 8px" }}>Студент</th>
                  <th style={{ padding: "10px 8px" }}>НБ</th>
                  <th style={{ padding: "10px 8px" }}>О</th>
                  <th style={{ padding: "10px 8px" }}>Итого %</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((r) => {
                  const isLow = r.pct < LOW_ATTENDANCE_THRESHOLD;
                  return (
                    <tr key={`${section.disciplineId}:${r.studentId}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 8px", fontWeight: 900 }}>{r.studentName}</td>
                      <td style={{ padding: "10px 8px" }}>{r.nb}</td>
                      <td style={{ padding: "10px 8px" }}>{r.o}</td>
                      <td style={{ padding: "10px 8px", fontWeight: 900, color: isLow ? "#dc2626" : "#111827" }}>{r.pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: 12, color: "#6b7280" }}>
              Всего занятий по предмету: <span style={{ fontWeight: 900 }}>{section.totalSessions}</span>
            </div>
          </div>
        ))
      )}
    </main>
  );
}

