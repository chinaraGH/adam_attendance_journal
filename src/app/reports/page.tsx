import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

const LOW_ATTENDANCE_THRESHOLD = 70;

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(param: string | undefined): Date | null {
  if (!param) return null;
  const d = new Date(param);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function ReportsPage(props: {
  searchParams: { groupId?: string; disciplineId?: string; from?: string; to?: string };
}) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "TEACHER" && actor.role !== "CURATOR") {
    return (
      <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Отчеты</h1>
        <p style={{ marginTop: 12 }}>Недостаточно прав.</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/">← Назад</Link>
        </p>
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

  const from = parseDate(props.searchParams.from) ?? defaultFrom;
  const to = parseDate(props.searchParams.to) ?? defaultTo;

  const disciplines = groupId
    ? await prisma.classSession.findMany({
        where: { groupId, isActive: true, deletedAt: null, startTime: { gte: from, lte: to } },
        distinct: ["disciplineId"],
        select: { disciplineId: true },
        orderBy: { disciplineId: "asc" },
      })
    : [];
  const disciplineId = props.searchParams.disciplineId ?? "";

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
            ...(disciplineId ? { disciplineId } : {}),
          },
          select: { id: true },
        })
      : [];

  const sessionIds = sessions.map((s) => s.id);
  const totalSessions = sessionIds.length;

  const agg =
    sessionIds.length === 0 || students.length === 0
      ? []
      : await prisma.attendance.groupBy({
          by: ["studentId", "statusV2"],
          where: {
            isActive: true,
            deletedAt: null,
            classSessionId: { in: sessionIds },
            studentId: { in: students.map((s) => s.id) },
            statusV2: { not: null },
          },
          _count: { _all: true },
        });

  const byStudent = new Map<string, { NB: number; O: number; P: number }>();
  for (const s of students) byStudent.set(s.id, { NB: 0, O: 0, P: 0 });
  for (const r of agg) {
    const rec = byStudent.get(r.studentId) ?? { NB: 0, O: 0, P: 0 };
    const st = (r.statusV2 ?? "").toUpperCase();
    if (st === "NB") rec.NB += r._count._all;
    if (st === "O") rec.O += r._count._all;
    if (st === "P") rec.P += r._count._all;
    byStudent.set(r.studentId, rec);
  }

  const rows = students.map((s) => {
    const c = byStudent.get(s.id) ?? { NB: 0, O: 0, P: 0 };
    const pct = totalSessions > 0 ? Math.round(((c.P + c.O) / totalSessions) * 1000) / 10 : 0;
    return { studentId: s.id, studentName: s.name, nb: c.NB, o: c.O, pct };
  });

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Отчеты</h1>
        <Link href="/" style={{ fontWeight: 900 }}>
          ← Назад
        </Link>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Фильтры</div>
        <form style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Группа
            <select
              name="groupId"
              defaultValue={groupId}
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Дисциплина
            <select
              name="disciplineId"
              defaultValue={disciplineId}
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
            >
              <option value="">Все</option>
              {disciplines.map((d) => (
                <option key={d.disciplineId} value={d.disciplineId}>
                  {d.disciplineId}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            С
            <input
              type="date"
              name="from"
              defaultValue={toDateInputValue(from)}
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            По
            <input
              type="date"
              name="to"
              defaultValue={toDateInputValue(to)}
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 800 }}
            />
          </label>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="submit"
              style={{
                width: "100%",
                border: "1px solid #111827",
                background: "#111827",
                color: "white",
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Применить
            </button>
          </div>
        </form>
        <div style={{ marginTop: 10, color: "#6b7280", fontWeight: 700 }}>
          Формула: % = (П + О) / всего занятий за период • Порог: {LOW_ATTENDANCE_THRESHOLD}%
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 14, background: "white", overflowX: "auto" }}>
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
    </main>
  );
}

