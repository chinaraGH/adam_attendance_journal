import { prisma } from "@/lib/prisma";
import { ExportTableButton } from "@/components/export-table-button";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { getCanonicalAttendanceStatusV2 } from "@/lib/attendance/status-machine";
import { fmtDate, page, h1, subtitle } from "@/lib/ui/office";
import { disciplinesLegend, groupMatrixSheet, type GroupMatrix } from "@/lib/points/group-matrix";
import { formatAttendanceStatusDisplay } from "@/lib/ui/labels";
import type { CanonStatus } from "@/lib/points/module-tables";

export const dynamic = "force-dynamic";

const th = { padding: "8px 8px", textAlign: "right" as const, fontSize: 12, color: "#374151", fontWeight: 800, whiteSpace: "nowrap" as const, borderBottom: "1px solid #e5e7eb" };
const td = { padding: "8px 8px", textAlign: "right" as const, fontSize: 14, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" as const };
const stickyName = { position: "sticky" as const, left: 0, background: "white", zIndex: 1 };
const center = { textAlign: "center" as const };

export default async function AdminGroupReportPage(props: { params: { groupId: string } }) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return (
      <main style={page}>
        <h1 style={h1}>Отчет по группе</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: "#6b7280" }}>Недостаточно прав.</p>
      </main>
    );
  }

  const groupId = props.params.groupId;

  const group = await prisma.group.findFirst({
    where: { id: groupId, isActive: true, deletedAt: null },
    select: { id: true, name: true, code: true },
  });
  if (!group) {
    return (
      <main style={page}>
        <h1 style={h1}>Отчет по группе</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: "#6b7280" }}>Группа не найдена.</p>
      </main>
    );
  }

  const semester =
    (await prisma.semester.findFirst({
      where: { isLocked: false },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    })) ??
    (await prisma.semester.findFirst({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    }));

  const sessions =
    semester?.id
      ? await prisma.classSession.findMany({
          where: { groupId, semesterId: semester.id, isActive: true, deletedAt: null, OR: [{ statusV2: { not: "cancelled" } }, { statusV2: null, status: { not: "cancelled" } }] },
          orderBy: { startTime: "asc" },
          take: 20,
          select: { id: true, startTime: true, discipline: { select: { code: true, name: true } } },
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
          where: { classSessionId: { in: sessionIds }, studentId: { in: students.map((s) => s.id) }, isActive: true, deletedAt: null },
          select: { studentId: true, classSessionId: true, statusV2: true, status: true },
        });

  const statusByKey = new Map<string, { text: string; status: CanonStatus | null }>();
  for (const a of attendance) {
    const c = getCanonicalAttendanceStatusV2({ statusV2: a.statusV2, status: a.status });
    statusByKey.set(`${a.studentId}:${a.classSessionId}`, {
      text: formatAttendanceStatusDisplay({ statusV2: a.statusV2, status: a.status }),
      status: (c as CanonStatus | null) ?? null,
    });
  }

  const abbrevMap: Record<string, string> = {
    MNG: "МЕН",
    DB: "БД",
    ENG: "АНГ",
    DE: "НЕМ",
    MATH: "МАТ",
    PHY: "ФИЗ",
    CHE: "ХИМ",
    BIO: "БИО",
    HIS: "ИСТ",
    GEO: "ГЕО",
    LIT: "ЛИТ",
    PE: "ФИЗРА",
  };
  const translateCode = (code: string | null) => {
    if (!code) return "-";
    return abbrevMap[code.toUpperCase()] || code;
  };

  const matrix: GroupMatrix = {
    columns: sessions.map((s) => ({
      id: s.id,
      date: fmtDate(s.startTime),
      discipline: translateCode(s.discipline?.code ?? null),
    })),
    rows: students.map((st) => ({
      studentId: st.id,
      name: st.name,
      cells: sessions.map((s) => statusByKey.get(`${st.id}:${s.id}`) ?? { text: "—", status: null }),
    })),
  };
  const legend = disciplinesLegend(
    sessions
      .filter((s) => s.discipline)
      .map((s) => ({ short: translateCode(s.discipline?.code ?? null), name: s.discipline?.name ?? "" })),
  );
  const semesterName = semester?.name ?? "семестр";
  const sheet = groupMatrixSheet(matrix, { groupName: group.name, semesterName, disciplinesLegend: legend });
  const codeDiffers = !!group.code && group.code.trim().toLowerCase() !== group.name.trim().toLowerCase();

  return (
    <main style={page}>
      <h1 style={h1}>
        {group.name}
        {codeDiffers ? <span style={{ fontSize: 14, fontWeight: 700, color: "#6b7280" }}> {group.code}</span> : null}
      </h1>
      <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 6 }}>Отчет группы (просмотр для учебной части/админа)</div>

      <section style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <ExportTableButton filename={`group-${groupId}.xlsx`} sheet={sheet} label="Скачать Excel (официальная ведомость)" />
        </div>
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "white" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left", ...stickyName }}>Студент</th>
                {matrix.columns.map((c) => (
                  <th key={c.id} style={{ ...th, ...center, padding: "8px 6px" }}>
                    {c.date}
                    <br />
                    <span style={{ fontWeight: 600 }}>{c.discipline}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((r) => (
                <tr key={r.studentId}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 700, ...stickyName }}>{r.name}</td>
                  {r.cells.map((c, k) => (
                    <td key={k} style={{ ...td, ...center, fontWeight: 700 }}>
                      {c.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {legend ? <div style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>Дисциплины: {legend}</div> : null}
      </section>
    </main>
  );
}
