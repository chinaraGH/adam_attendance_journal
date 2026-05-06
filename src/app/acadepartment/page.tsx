import Link from "next/link";
import { revalidatePath } from "next/cache";

import { buildAcadepartmentAttendanceCharts } from "@/lib/academic/build-acadepartment-charts";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

import { AcadepartmentChartsWithFilters, AcadepartmentNavButtons } from "./attendance-charts";

function qNorm(v: string | undefined) {
  return (v ?? "").trim();
}

async function setClassSessionCancelledState(formData: FormData) {
  "use server";

  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return;
  }

  const classSessionId = String(formData.get("classSessionId") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim().toLowerCase();
  if (!classSessionId || (next !== "cancel" && next !== "restore")) {
    return;
  }

  const session = await prisma.classSession.findFirst({
    where: { id: classSessionId, isActive: true, deletedAt: null },
    select: { id: true, status: true, statusV2: true, semester: { select: { isLocked: true } } },
  });
  if (!session || session.semester?.isLocked) {
    return;
  }

  const nextStatus = next === "cancel" ? "cancelled" : "scheduled";
  await prisma.classSession.update({
    where: { id: session.id },
    data: { status: nextStatus, statusV2: nextStatus },
    select: { id: true },
  });

  await prisma.auditTrail.create({
    data: {
      actorType: actor.role.toLowerCase(),
      actorId: actor.id,
      action: next === "cancel" ? "class_session_cancel" : "class_session_restore",
      entityType: "ClassSession",
      entityId: session.id,
      beforeJson: JSON.stringify({ status: session.status, statusV2: session.statusV2 }),
      afterJson: JSON.stringify({ status: nextStatus, statusV2: nextStatus }),
    },
    select: { id: true },
  });

  revalidatePath("/acadepartment");
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
  const semesterScopeParam = qNorm((props.searchParams as { semesterScope?: string }).semesterScope);
  const semesterScope: "all" | "out" = semesterScopeParam === "out" ? "out" : "all";

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

  const sessionsForCancellation = await prisma.classSession.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(semesterScope === "out" ? { outOfSemester: true } : {}),
    },
    orderBy: { startTime: "desc" },
    take: 40,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
      statusV2: true,
      outOfSemester: true,
      group: { select: { name: true, code: true } },
      discipline: { select: { name: true, code: true } },
      teacher: { select: { name: true } },
    },
  });
  const outOfSemesterAnomalies = await prisma.classSession.findMany({
    where: { isActive: true, deletedAt: null, outOfSemester: true },
    orderBy: { startTime: "desc" },
    take: 200,
    select: {
      id: true,
      group: {
        select: {
          id: true,
          name: true,
          code: true,
          program: {
            select: {
              name: true,
              department: { select: { name: true } },
            },
          },
        },
      },
      teacher: { select: { id: true, name: true } },
    },
  });
  const anomalyByDepartment = new Map<string, number>();
  const anomalyByGroup = new Map<string, number>();
  const anomalyByTeacher = new Map<string, number>();
  for (const session of outOfSemesterAnomalies) {
    const departmentName = session.group.program?.department?.name ?? "Без кафедры";
    const groupLabel = session.group.code ?? session.group.name;
    const teacherLabel = session.teacher?.name ?? "Без преподавателя";
    anomalyByDepartment.set(departmentName, (anomalyByDepartment.get(departmentName) ?? 0) + 1);
    anomalyByGroup.set(groupLabel, (anomalyByGroup.get(groupLabel) ?? 0) + 1);
    anomalyByTeacher.set(teacherLabel, (anomalyByTeacher.get(teacherLabel) ?? 0) + 1);
  }
  const topDepartmentAnomalies = Array.from(anomalyByDepartment.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topGroupAnomalies = Array.from(anomalyByGroup.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topTeacherAnomalies = Array.from(anomalyByTeacher.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

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

      <section style={{ marginTop: 24, borderRadius: 14, border: "1px solid #e5e7eb", background: "white", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: "#111827" }}>Управление отменой занятий</h2>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
            Отмена/разотмена доступны только на экране учебной части
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
          Синхронизация расписания не управляет отменой. Ниже отображаются последние занятия.
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href="/acadepartment"
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 800,
              color: semesterScope === "all" ? "#111827" : "#4b5563",
              textDecoration: "none",
              background: semesterScope === "all" ? "#f3f4f6" : "white",
            }}
          >
            Все занятия
          </Link>
          <Link
            href="/acadepartment?semesterScope=out"
            style={{
              border: "1px solid #f59e0b",
              borderRadius: 10,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 800,
              color: semesterScope === "out" ? "#92400e" : "#78350f",
              textDecoration: "none",
              background: semesterScope === "out" ? "#fef3c7" : "white",
            }}
          >
            Только вне семестров
          </Link>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, alignSelf: "center" }}>
            После изменения границ запустите пересопоставление занятий.
          </div>
        </div>
        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "8px 6px" }}>Дата/время</th>
                <th style={{ padding: "8px 6px" }}>Группа</th>
                <th style={{ padding: "8px 6px" }}>Дисциплина</th>
                <th style={{ padding: "8px 6px" }}>Преподаватель</th>
                <th style={{ padding: "8px 6px" }}>Статус</th>
                <th style={{ padding: "8px 6px" }}>Семестр</th>
                <th style={{ padding: "8px 6px" }}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {sessionsForCancellation.map((s) => {
                const current = (s.statusV2 ?? s.status ?? "scheduled").toLowerCase();
                const isCancelled = current === "cancelled";
                const isOutOfSemester = Boolean(s.outOfSemester);
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 6px", fontWeight: 700 }}>
                      {new Date(s.startTime).toLocaleString("ru-RU")} - {new Date(s.endTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "8px 6px" }}>{s.group.code ?? s.group.name}</td>
                    <td style={{ padding: "8px 6px" }}>{s.discipline.code ?? s.discipline.name}</td>
                    <td style={{ padding: "8px 6px" }}>{s.teacher?.name ?? "—"}</td>
                    <td style={{ padding: "8px 6px", fontWeight: 800, color: isCancelled ? "#b91c1c" : "#065f46" }}>
                      {isCancelled ? "Отменено" : "Активно в расписании"}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      {isOutOfSemester ? (
                        <span
                          style={{
                            border: "1px solid #f59e0b",
                            background: "#fef3c7",
                            color: "#92400e",
                            borderRadius: 999,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontWeight: 900,
                          }}
                        >
                          Вне семестров
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#047857", fontWeight: 800 }}>В семестре</span>
                      )}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <form action={setClassSessionCancelledState}>
                        <input type="hidden" name="classSessionId" value={s.id} />
                        <input type="hidden" name="next" value={isCancelled ? "restore" : "cancel"} />
                        <button
                          type="submit"
                          style={{
                            border: `1px solid ${isCancelled ? "#065f46" : "#b91c1c"}`,
                            background: isCancelled ? "#065f46" : "#b91c1c",
                            color: "white",
                            borderRadius: 10,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {isCancelled ? "Снять отмену" : "Отменить"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 24, borderRadius: 14, border: "1px solid #fde68a", background: "#fffbeb", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: "#92400e" }}>Аномалии расписания (вне семестров)</h2>
          <div style={{ fontSize: 12, color: "#92400e", fontWeight: 800 }}>
            Всего занятий вне семестров: {outOfSemesterAnomalies.length}
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: "#78350f", fontWeight: 600 }}>
          Контроль качества данных: топ-группировки по кафедрам, группам и преподавателям.
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div style={{ border: "1px solid #fcd34d", borderRadius: 12, background: "white", padding: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: "#92400e", marginBottom: 6 }}>По кафедрам</div>
            {topDepartmentAnomalies.length === 0 ? (
              <div style={{ fontSize: 12, color: "#6b7280" }}>Нет данных.</div>
            ) : (
              topDepartmentAnomalies.map(([key, count]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                  <span>{key}</span>
                  <strong>{count}</strong>
                </div>
              ))
            )}
          </div>
          <div style={{ border: "1px solid #fcd34d", borderRadius: 12, background: "white", padding: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: "#92400e", marginBottom: 6 }}>По группам</div>
            {topGroupAnomalies.length === 0 ? (
              <div style={{ fontSize: 12, color: "#6b7280" }}>Нет данных.</div>
            ) : (
              topGroupAnomalies.map(([key, count]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                  <span>{key}</span>
                  <strong>{count}</strong>
                </div>
              ))
            )}
          </div>
          <div style={{ border: "1px solid #fcd34d", borderRadius: 12, background: "white", padding: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: "#92400e", marginBottom: 6 }}>По преподавателям</div>
            {topTeacherAnomalies.length === 0 ? (
              <div style={{ fontSize: 12, color: "#6b7280" }}>Нет данных.</div>
            ) : (
              topTeacherAnomalies.map(([key, count]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                  <span>{key}</span>
                  <strong>{count}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

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
