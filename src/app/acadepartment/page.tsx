import Link from "next/link";
import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";

import { buildAcadepartmentAttendanceCharts } from "@/lib/academic/build-acadepartment-charts";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

import { btnOutline, btnPrimary, btnSmallDanger, btnSmallOutline, card, field, fmtDateTime, fmtTime, h1, h2, hint, listItem, notice, page, subCard, subtitle, td, th, tableWrap } from "@/lib/ui/office";

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

async function createFaculty(formData: FormData) {
  "use server";

  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") return;

  const name = String(formData.get("name") ?? "").trim();
  const codeRaw = String(formData.get("code") ?? "").trim();
  const code = codeRaw.length > 0 ? codeRaw : null;
  if (!name) return;

  await prisma.faculty.create({
    data: {
      name,
      code,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  revalidatePath("/acadepartment");
}

async function createDepartment(formData: FormData) {
  "use server";

  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") return;

  const facultyId = String(formData.get("facultyId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const codeRaw = String(formData.get("code") ?? "").trim();
  const code = codeRaw.length > 0 ? codeRaw : null;
  if (!facultyId || !name) return;

  await prisma.department.create({
    data: {
      facultyId,
      name,
      code,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  revalidatePath("/acadepartment");
}

async function createProgram(formData: FormData) {
  "use server";

  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") return;

  const facultyId = String(formData.get("facultyId") ?? "").trim();
  const departmentId = String(formData.get("departmentId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const codeRaw = String(formData.get("code") ?? "").trim();
  const code = codeRaw.length > 0 ? codeRaw : null;
  if (!facultyId || !departmentId || !name) return;

  await prisma.program.create({
    data: {
      facultyId,
      departmentId,
      name,
      code,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  revalidatePath("/acadepartment");
}

async function createDiscipline(formData: FormData) {
  "use server";

  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") return;

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const departmentIdRaw = String(formData.get("departmentId") ?? "").trim();
  const departmentId = departmentIdRaw.length > 0 ? departmentIdRaw : null;
  if (!name || !code || !departmentId) return;

  await prisma.discipline.create({
    data: {
      name,
      code,
      departmentId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  revalidatePath("/acadepartment");
}

export default async function AcadepartmentPage(props: { searchParams: { q?: string } }) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return (
      <main style={page}>
        <h1 style={h1}>Учебная часть</h1>
        <p style={subtitle}>Недостаточно прав.</p>
      </main>
    );
  }

  const q = qNorm(props.searchParams.q);
  const semesterIdParam = qNorm((props.searchParams as { semesterId?: string }).semesterId);
  const semesterId = semesterIdParam.length > 0 ? semesterIdParam : undefined;

  const facultiesForInput = await prisma.faculty.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
  const departmentsForInput = await prisma.department.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, facultyId: true },
  });

  const charts = await buildAcadepartmentAttendanceCharts(semesterId);

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
          by: ["studentId"],
          where: {
            isActive: true,
            deletedAt: null,
            studentId: { in: studentIds },
            OR: [
              { statusV2: { in: ["B_PENDING", "B_CONFIRMED"] } },
              { statusV2: null, status: { in: ["B_PENDING", "B_CONFIRMED", "excused"] } }
            ],
          },
          _count: { _all: true },
        });
  const sickCountByStudent = new Map<string, number>();
  for (const r of sickAgg) {
    sickCountByStudent.set(r.studentId, (sickCountByStudent.get(r.studentId) ?? 0) + r._count._all);
  }

  const problemStudentsAgg = await prisma.attendance.groupBy({
    by: ["studentId"],
    where: {
      isActive: true,
      deletedAt: null,
      OR: [{ statusV2: "NB" }, { statusV2: null, status: { in: ["NB", "absent"] } }],
      classSession: { startTime: { gte: new Date(charts.semesterStartIso ?? "2000-01-01"), lte: new Date(charts.semesterEndIso ?? "2099-01-01") } }
    },
    _count: { _all: true },
    orderBy: { _count: { studentId: "desc" } },
    take: 15,
  });

  const problemStudentIdsTop = problemStudentsAgg.map((x) => x.studentId);
  const problemStudentsData = await prisma.student.findMany({
    where: { id: { in: problemStudentIdsTop } },
    select: { id: true, name: true, gaudiId: true, group: { select: { id: true, name: true } } }
  });
  const problemStudentsDataMap = new Map(problemStudentsData.map((s) => [s.id, s]));
  const problemStudentsList = problemStudentsAgg.map((a) => {
    const st = problemStudentsDataMap.get(a.studentId);
    return {
      id: a.studentId,
      name: st?.name ?? "—",
      groupName: st?.group?.name ?? "—",
      nbCount: a._count._all,
    };
  });

  const facultiesSearch =
    q.length > 0
      ? await prisma.faculty.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }],
          },
          take: 10,
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true },
        })
      : [];

  const programsSearch =
    q.length > 0
      ? await prisma.program.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }],
          },
          take: 10,
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true, department: { select: { name: true } } },
        })
      : [];

  const disciplinesSearch =
    q.length > 0
      ? await prisma.discipline.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }],
          },
          take: 10,
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true },
        })
      : [];

  const sessionsForCancellation = await prisma.classSession.findMany({
    where: {
      isActive: true,
      deletedAt: null,
    },
    orderBy: { startTime: "desc" },
    take: 40,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
      statusV2: true,
      group: { select: { name: true, code: true } },
      discipline: { select: { name: true, code: true } },
      teacher: { select: { name: true } },
    },
  });
  const isAdmin = actor.role === "ADMIN";

  const ResultSection = (props: { title: string; empty: boolean; children: ReactNode }) => (
    <section style={{ ...card, marginTop: 0 }}>
      <h3 style={{ ...h2, fontSize: 15 }}>{props.title}</h3>
      {props.empty ? (
        <div style={{ ...hint, marginTop: 8 }}>Нет результатов.</div>
      ) : (
        <ul style={{ marginTop: 10, display: "grid", gap: 8, padding: 0, listStyle: "none" }}>{props.children}</ul>
      )}
    </section>
  );

  const linkStyle = { color: "#111827", fontWeight: 800, textDecoration: "underline" } as const;
  const muted = { fontSize: 13, color: "#6b7280" } as const;

  return (
    <main style={page}>
      <h1 style={h1}>Учебная часть</h1>
      <div style={subtitle}>Посещаемость, баллы и справочники университета.</div>

      <div style={{ marginTop: 12 }}>
        <AcadepartmentNavButtons
          allSemesters={charts.allSemesters}
          currentSemesterId={semesterId}
          qParam={q}
          isAdmin={isAdmin}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        {charts.emptyMessage ? <div style={{ ...notice, marginBottom: 12 }}>{charts.emptyMessage}</div> : null}
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

      <section style={card}>
        <h2 style={h2}>Поиск</h2>
        <form style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {semesterIdParam ? <input type="hidden" name="semesterId" value={semesterIdParam} /> : null}
          <input name="q" defaultValue={q} placeholder="ФИО, код или идентификатор" style={{ ...field, flex: 1, minWidth: 240, width: "auto" }} />
          <button type="submit" style={btnPrimary}>
            Найти
          </button>
        </form>

        {q.length === 0 ? (
          <div style={{ ...hint, marginTop: 10 }}>Введите запрос: студент, преподаватель, группа, факультет, образовательная программа или дисциплина.</div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            <ResultSection title="Студенты" empty={students.length === 0}>
              {students.map((s) => (
                <li key={s.id} style={listItem}>
                  <div>
                    <Link style={linkStyle} href={`/admin/students/${s.id}`}>
                      {s.name}
                    </Link>
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#6b7280" }}>Б*: {sickCountByStudent.get(s.id) ?? 0}</span>
                  </div>
                  <div style={muted}>
                    {s.gaudiId} ·{" "}
                    <Link style={linkStyle} href={`/admin/groups/${s.group.id}`}>
                      {s.group.code ?? s.group.name}
                    </Link>
                  </div>
                </li>
              ))}
            </ResultSection>

            <ResultSection title="Преподаватели" empty={teachers.length === 0}>
              {teachers.map((t) => (
                <li key={t.id} style={listItem}>
                  <div style={{ fontWeight: 800 }}>{t.name}</div>
                  <div style={muted}>{t.gaudiId ?? "—"}</div>
                </li>
              ))}
            </ResultSection>

            <ResultSection title="Группы" empty={groups.length === 0}>
              {groups.map((g) => (
                <li key={g.id} style={listItem}>
                  <Link style={linkStyle} href={`/admin/groups/${g.id}`}>
                    {g.name}
                  </Link>
                  <div style={muted}>{g.code && g.code !== g.name ? g.code : ""}</div>
                </li>
              ))}
            </ResultSection>

            <ResultSection title="Факультеты" empty={facultiesSearch.length === 0}>
              {facultiesSearch.map((f) => (
                <li key={f.id} style={listItem}>
                  <div style={{ fontWeight: 800 }}>{f.name}</div>
                  <div style={muted}>{f.code ?? ""}</div>
                </li>
              ))}
            </ResultSection>

            <ResultSection title="Образовательные программы" empty={programsSearch.length === 0}>
              {programsSearch.map((p) => (
                <li key={p.id} style={listItem}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{p.name}</div>
                    {p.department?.name ? <div style={muted}>{p.department.name}</div> : null}
                  </div>
                  <div style={muted}>{p.code ?? ""}</div>
                </li>
              ))}
            </ResultSection>

            <ResultSection title="Дисциплины" empty={disciplinesSearch.length === 0}>
              {disciplinesSearch.map((d) => (
                <li key={d.id} style={listItem}>
                  <div style={{ fontWeight: 800 }}>{d.name}</div>
                  <div style={muted}>{d.code ?? ""}</div>
                </li>
              ))}
            </ResultSection>
          </div>
        )}
      </section>

      <section style={card}>
        <details>
          <summary style={{ ...btnOutline, display: "inline-flex", listStyle: "none", cursor: "pointer" }}>Студенты с наибольшим числом пропусков ▾</summary>
          <div style={{ ...hint, marginTop: 10 }}>До 15 студентов с наибольшим числом НБ в выбранном семестре.</div>
          <div style={{ marginTop: 12 }}>
          {problemStudentsList.length === 0 ? (
            <div style={hint}>Нет данных о пропусках.</div>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {problemStudentsList.map((st, i) => (
                <li key={st.id} style={listItem}>
                  <div>
                    <div>
                      <span style={{ color: "#6b7280", marginRight: 6 }}>{i + 1}.</span>
                      <Link href={`/admin/students/${st.id}`} style={linkStyle}>
                        {st.name}
                      </Link>
                    </div>
                    <div style={muted}>{st.groupName}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: 16 }}>{st.nbCount}</strong>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>НБ</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          </div>
        </details>
      </section>

      <section style={card}>
        <h2 style={h2}>Отмена занятий</h2>
        <div style={hint}>
          Отменять и возвращать занятия можно только здесь: синхронизация расписания этим не управляет. Показаны последние 40 занятий.
        </div>
        <div style={{ ...tableWrap, marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead>
              <tr>
                <th style={th}>Дата и время</th>
                <th style={th}>Группа</th>
                <th style={th}>Дисциплина</th>
                <th style={th}>Преподаватель</th>
                <th style={th}>Статус</th>
                <th style={th}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {sessionsForCancellation.map((s) => {
                const current = (s.statusV2 ?? s.status ?? "scheduled").toLowerCase();
                const isCancelled = current === "cancelled";
                return (
                  <tr key={s.id}>
                    <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {fmtDateTime(s.startTime)}–{fmtTime(s.endTime)}
                    </td>
                    <td style={td}>{s.group.code ?? s.group.name}</td>
                    <td style={td}>{s.discipline.code ?? s.discipline.name}</td>
                    <td style={td}>{s.teacher?.name ?? "—"}</td>
                    <td style={{ ...td, fontWeight: 800, color: isCancelled ? "#991b1b" : "#111827", whiteSpace: "nowrap" }}>
                      {isCancelled ? "Отменено" : "По расписанию"}
                    </td>
                    <td style={td}>
                      <form action={setClassSessionCancelledState}>
                        <input type="hidden" name="classSessionId" value={s.id} />
                        <input type="hidden" name="next" value={isCancelled ? "restore" : "cancel"} />
                        <button type="submit" style={isCancelled ? { ...btnSmallOutline, minWidth: 140 } : { ...btnSmallDanger, minWidth: 140 }}>
                          {isCancelled ? "Вернуть занятие" : "Отменить"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {sessionsForCancellation.length === 0 ? (
                <tr>
                  <td style={{ ...td, color: "#6b7280" }} colSpan={6}>
                    Занятий нет.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>Справочники</h2>
        <div style={hint}>Ручной ввод: факультет, кафедра, образовательная программа, дисциплина.</div>
        <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "stretch" }}>
          <form action={createFaculty} style={subCard}>
            <div style={{ fontWeight: 800 }}>Факультет</div>
            <input name="name" placeholder="Наименование" required style={field} />
            <input name="code" placeholder="Код (необязательно)" style={field} />
            <button type="submit" style={{ ...btnPrimary, width: "100%", marginTop: "auto" }}>
              Добавить факультет
            </button>
          </form>

          <form action={createDepartment} style={subCard}>
            <div style={{ fontWeight: 800 }}>Кафедра</div>
            <select name="facultyId" required style={field}>
              <option value="">Выберите факультет</option>
              {facultiesForInput.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code ?? f.name}
                </option>
              ))}
            </select>
            <input name="name" placeholder="Наименование" required style={field} />
            <input name="code" placeholder="Код (необязательно)" style={field} />
            <button type="submit" style={{ ...btnPrimary, width: "100%", marginTop: "auto" }}>
              Добавить кафедру
            </button>
          </form>

          <form action={createProgram} style={subCard}>
            <div style={{ fontWeight: 800 }}>Образовательная программа</div>
            <select name="facultyId" required style={field}>
              <option value="">Выберите факультет</option>
              {facultiesForInput.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code ?? f.name}
                </option>
              ))}
            </select>
            <select name="departmentId" required style={field}>
              <option value="">Выберите кафедру</option>
              {departmentsForInput.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code ?? d.name}
                </option>
              ))}
            </select>
            <input name="name" placeholder="Наименование" required style={field} />
            <input name="code" placeholder="Код (необязательно)" style={field} />
            <button type="submit" style={{ ...btnPrimary, width: "100%", marginTop: "auto" }}>
              Добавить программу
            </button>
          </form>

          <form action={createDiscipline} style={subCard}>
            <div style={{ fontWeight: 800 }}>Дисциплина</div>
            <select name="departmentId" required style={field}>
              <option value="">Выберите кафедру</option>
              {departmentsForInput.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code ?? d.name}
                </option>
              ))}
            </select>
            <input name="name" placeholder="Наименование" required style={field} />
            <input name="code" placeholder="Код, как в расписании" required style={{ ...field, textTransform: "uppercase" }} />
            <button type="submit" style={{ ...btnPrimary, width: "100%", marginTop: "auto" }}>
              Добавить дисциплину
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
