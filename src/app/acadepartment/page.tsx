import Link from "next/link";

import { buildAcadepartmentAttendanceCharts } from "@/lib/academic/build-acadepartment-charts";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

import { AcadepartmentChartsWithFilters, AcadepartmentNavButtons } from "./attendance-charts";

function qNorm(v: string | undefined) {
  return (v ?? "").trim();
}

export default async function AcadepartmentPage(props: { searchParams: { q?: string } }) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return (
      <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Учебная часть</h1>
        <p style={{ marginTop: 12, fontSize: 14, color: "#6b7280", fontWeight: 600 }}>Недостаточно прав.</p>
      </main>
    );
  }

  const q = qNorm(props.searchParams.q);

  const charts = await buildAcadepartmentAttendanceCharts();

  const students =
    q.length > 0
      ? await prisma.student.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { gaudiId: { contains: q, mode: "insensitive" } },
              { id: { contains: q } },
            ],
          },
          take: 20,
          orderBy: { name: "asc" },
          select: { id: true, name: true, gaudiId: true, group: { select: { id: true, name: true, code: true } } },
        })
      : [];

  const teachers =
    q.length > 0
      ? await prisma.teacher.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [{ name: { contains: q, mode: "insensitive" } }, { gaudiId: { contains: q, mode: "insensitive" } }, { id: { contains: q } }],
          },
          take: 20,
          orderBy: { name: "asc" },
          select: { id: true, name: true, gaudiId: true },
        })
      : [];

  const groups =
    q.length > 0
      ? await prisma.group.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { id: { contains: q } }],
          },
          take: 20,
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true },
        })
      : [];

  const studentIds = students.map((s) => s.id);
  const sickAgg =
    studentIds.length === 0
      ? []
      : await prisma.attendance.groupBy({
          by: ["studentId", "statusV2"],
          where: {
            isActive: true,
            deletedAt: null,
            studentId: { in: studentIds },
            statusV2: { in: ["B_PENDING", "B_CONFIRMED"] },
          },
          _count: { _all: true },
        });
  const sickCountByStudent = new Map<string, number>();
  for (const r of sickAgg) {
    sickCountByStudent.set(r.studentId, (sickCountByStudent.get(r.studentId) ?? 0) + r._count._all);
  }

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: "#111827" }}>Учебная часть</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#6b7280", fontWeight: 600 }}>
            Семестр: <span style={{ fontWeight: 800, color: "#111827" }}>{charts.semesterName ?? "—"}</span>
          </p>
        </div>
        <AcadepartmentNavButtons />
      </div>

      <div style={{ marginTop: 20 }}>
        {charts.emptyMessage ? (
          <p
            style={{
              marginBottom: 16,
              borderRadius: 12,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 800,
              color: "#92400e",
            }}
          >
            {charts.emptyMessage}
          </p>
        ) : null}
        <AcadepartmentChartsWithFilters
          weekKeys={charts.weekKeys}
          emptyHint={null}
          facultyCourseWeekly={charts.facultyCourseWeekly}
          programCourseWeekly={charts.programCourseWeekly}
          facultyOptions={charts.facultyOptions}
          programOptions={charts.programOptions}
          courseOptions={charts.courseOptions}
          semesterStartIso={charts.semesterStartIso}
          semesterEndIso={charts.semesterEndIso}
        />
      </div>

      <section style={{ marginTop: 36, borderTop: "1px solid #e5e7eb", paddingTop: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: "#111827" }}>Поиск</h2>
        <form style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="ФИО / код / ID"
            style={{
              minWidth: 260,
              flex: 1,
              borderRadius: 12,
              border: "1px solid #d1d5db",
              padding: "10px 12px",
              fontWeight: 700,
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            style={{
              borderRadius: 12,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Найти
          </button>
        </form>

        {q.length === 0 ? (
          <div style={{ marginTop: 16, fontSize: 14, color: "#6b7280", fontWeight: 600 }}>Введите запрос: студент / преподаватель / группа.</div>
        ) : (
          <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
            <section style={{ borderRadius: 14, border: "1px solid #e5e7eb", background: "white", padding: 16 }}>
              <div style={{ fontWeight: 900 }}>Студенты</div>
              {students.length === 0 ? (
                <div style={{ marginTop: 8, fontSize: 14, color: "#6b7280" }}>Нет результатов.</div>
              ) : (
                <ul style={{ marginTop: 12, display: "grid", gap: 8, padding: 0, listStyle: "none" }}>
                  {students.map((s) => (
                    <li
                      key={s.id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        gap: 8,
                        borderRadius: 12,
                        border: "1px solid #f3f4f6",
                        padding: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900 }}>
                          <Link style={{ color: "#1e40af", fontWeight: 900 }} href={`/admin/students/${s.id}`}>
                            {s.name}
                          </Link>
                          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 900, color: "#1d4ed8" }}>
                            Б*: {sickCountByStudent.get(s.id) ?? 0}
                          </span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 14, color: "#6b7280" }}>
                          {s.gaudiId} •{" "}
                          <Link style={{ fontWeight: 800, color: "#1e40af" }} href={`/admin/groups/${s.group.id}`}>
                            {s.group.code ?? s.group.name}
                          </Link>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{s.id}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={{ borderRadius: 14, border: "1px solid #e5e7eb", background: "white", padding: 16 }}>
              <div style={{ fontWeight: 900 }}>Преподаватели</div>
              {teachers.length === 0 ? (
                <div style={{ marginTop: 8, fontSize: 14, color: "#6b7280" }}>Нет результатов.</div>
              ) : (
                <ul style={{ marginTop: 12, display: "grid", gap: 8, padding: 0, listStyle: "none" }}>
                  {teachers.map((t) => (
                    <li
                      key={t.id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        gap: 8,
                        borderRadius: 12,
                        border: "1px solid #f3f4f6",
                        padding: 12,
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>{t.name}</div>
                      <div style={{ fontSize: 14, color: "#6b7280" }}>
                        {t.gaudiId ?? "—"} • <span style={{ fontSize: 12 }}>{t.id}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={{ borderRadius: 14, border: "1px solid #e5e7eb", background: "white", padding: 16 }}>
              <div style={{ fontWeight: 900 }}>Группы</div>
              {groups.length === 0 ? (
                <div style={{ marginTop: 8, fontSize: 14, color: "#6b7280" }}>Нет результатов.</div>
              ) : (
                <ul style={{ marginTop: 12, display: "grid", gap: 8, padding: 0, listStyle: "none" }}>
                  {groups.map((g) => (
                    <li
                      key={g.id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        gap: 8,
                        borderRadius: 12,
                        border: "1px solid #f3f4f6",
                        padding: 12,
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>
                        <Link style={{ color: "#1e40af", fontWeight: 900 }} href={`/admin/groups/${g.id}`}>
                          {g.name}
                        </Link>
                      </div>
                      <div style={{ fontSize: 14, color: "#6b7280" }}>{g.code ?? "—"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
