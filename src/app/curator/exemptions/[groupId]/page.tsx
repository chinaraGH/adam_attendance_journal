import Link from "next/link";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { isAfter } from "date-fns";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { BISHKEK_TIME_ZONE, getBishkekNow } from "@/lib/time/bishkek-now";
import { formatDisciplineLabel } from "@/lib/ui/labels";
import { getCanonicalAttendanceStatusV2 } from "@/lib/attendance/status-machine";

import { SetAdministrativeAbsenceButton } from "../set-a-button";

function parseYmd(param: string | undefined): string | null {
  if (!param || typeof param !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(param.trim());
  return m ? param.trim() : null;
}

type ExemptionRow = {
  studentId: string;
  studentName: string;
  sessionId: string;
  disciplineLabel: string;
  startTime: Date;
  endTime: Date;
  dateLabel: string;
  timeLabel: string;
  statusLabel: string;
  attendanceId: string | null;
  canSetA: boolean;
  semesterLocked: boolean;
  actionHint: string | null;
};

function computeSetAState(params: {
  canonical: ReturnType<typeof getCanonicalAttendanceStatusV2>;
  semesterLocked: boolean;
  classEnded: boolean;
  hasAttendance: boolean;
}): { canSetA: boolean; actionHint: string | null } {
  const { canonical, semesterLocked, classEnded, hasAttendance } = params;
  if (!hasAttendance || !canonical || canonical === "A") {
    return { canSetA: false, actionHint: null };
  }
  if (semesterLocked) return { canSetA: false, actionHint: "Семестр закрыт" };
  if (!classEnded) return { canSetA: false, actionHint: "После окончания занятия" };
  if (canonical === "B_CONFIRMED") return { canSetA: false, actionHint: "Статус B_CONFIRMED не меняется" };
  return { canSetA: true, actionHint: null };
}

export default async function CuratorGroupExemptionsPage(props: {
  params: { groupId: string };
  searchParams: { date?: string };
}) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "CURATOR") {
    return (
      <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Освобождения</h1>
        <p style={{ marginTop: 12 }}>Недостаточно прав.</p>
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
      <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Освобождения</h1>
        <p style={{ marginTop: 12 }}>Нет доступа к группе.</p>
        <Link href="/curator/exemptions" style={{ marginTop: 12, display: "inline-block", fontWeight: 800 }}>
          К списку групп
        </Link>
      </main>
    );
  }

  const group = await prisma.group.findFirst({
    where: { id: groupId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!group) {
    return (
      <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Освобождения</h1>
        <p style={{ marginTop: 12 }}>Группа не найдена.</p>
      </main>
    );
  }

  const todayYmd = formatInTimeZone(new Date(), BISHKEK_TIME_ZONE, "yyyy-MM-dd");
  const selectedDate = parseYmd(props.searchParams.date) ?? todayYmd;

  const semester =
    (await prisma.semester.findFirst({
      where: { isLocked: false },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, endDate: true, isLocked: true },
    })) ??
    (await prisma.semester.findFirst({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, endDate: true, isLocked: true },
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
          select: {
            id: true,
            startTime: true,
            endTime: true,
            disciplineId: true,
            discipline: { select: { name: true } },
            semester: { select: { isLocked: true } },
          },
        })
      : [];

  const sessionsOnDay = sessions.filter(
    (s) => formatInTimeZone(s.startTime, BISHKEK_TIME_ZONE, "yyyy-MM-dd") === selectedDate,
  );

  const students = await prisma.student.findMany({
    where: { groupId, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const studentById = new Map(students.map((s) => [s.id, s]));

  const nowBishkek = getBishkekNow();

  const sickSemesterAttendances =
    sessions.length === 0 || students.length === 0
      ? []
      : await prisma.attendance.findMany({
          where: {
            classSessionId: { in: sessions.map((s) => s.id) },
            studentId: { in: students.map((s) => s.id) },
            isActive: true,
            deletedAt: null,
            OR: [
              { statusV2: { in: ["B_PENDING", "B_CONFIRMED"] } },
              { AND: [{ statusV2: null }, { status: { in: ["B_PENDING", "B_CONFIRMED", "B"] } }] },
            ],
          },
          select: { id: true, studentId: true, classSessionId: true, statusV2: true, status: true },
          orderBy: [{ classSessionId: "asc" }, { studentId: "asc" }],
        });

  const sickSemesterRows: ExemptionRow[] = [];
  for (const att of sickSemesterAttendances) {
    const canonical = getCanonicalAttendanceStatusV2({ statusV2: att.statusV2, status: att.status });
    if (canonical !== "B_PENDING" && canonical !== "B_CONFIRMED") continue;

    const session = sessionById.get(att.classSessionId);
    const st = studentById.get(att.studentId);
    if (!session || !st) continue;

    const endBishkek = toZonedTime(session.endTime, BISHKEK_TIME_ZONE);
    const classEnded = isAfter(nowBishkek, endBishkek);
    const semesterLocked = !!session.semester?.isLocked || !!semester?.isLocked;
    const { canSetA, actionHint } = computeSetAState({
      canonical,
      semesterLocked,
      classEnded,
      hasAttendance: true,
    });

    sickSemesterRows.push({
      studentId: st.id,
      studentName: st.name,
      sessionId: session.id,
      disciplineLabel: formatDisciplineLabel({
        disciplineId: session.disciplineId,
        disciplineName: session.discipline?.name,
      }),
      startTime: session.startTime,
      endTime: session.endTime,
      dateLabel: formatInTimeZone(session.startTime, BISHKEK_TIME_ZONE, "dd.MM.yyyy"),
      timeLabel: `${formatInTimeZone(session.startTime, BISHKEK_TIME_ZONE, "HH:mm")}–${formatInTimeZone(session.endTime, BISHKEK_TIME_ZONE, "HH:mm")}`,
      statusLabel: canonical,
      attendanceId: att.id,
      canSetA,
      semesterLocked,
      actionHint,
    });
  }

  const sessionIds = sessionsOnDay.map((s) => s.id);
  const attendances =
    sessionIds.length === 0 || students.length === 0
      ? []
      : await prisma.attendance.findMany({
          where: {
            classSessionId: { in: sessionIds },
            studentId: { in: students.map((s) => s.id) },
            isActive: true,
            deletedAt: null,
          },
          select: { id: true, studentId: true, classSessionId: true, statusV2: true, status: true },
        });

  const attendanceByKey = new Map(attendances.map((a) => [`${a.studentId}:${a.classSessionId}`, a] as const));

  const rows: ExemptionRow[] = [];
  for (const session of sessionsOnDay) {
    for (const st of students) {
      const att = attendanceByKey.get(`${st.id}:${session.id}`) ?? null;
      const canonical = att ? getCanonicalAttendanceStatusV2({ statusV2: att.statusV2, status: att.status }) : null;
      const statusLabel = canonical ?? "—";
      const endBishkek = toZonedTime(session.endTime, BISHKEK_TIME_ZONE);
      const classEnded = isAfter(nowBishkek, endBishkek);
      const semesterLocked = !!session.semester?.isLocked || !!semester?.isLocked;

      const { canSetA, actionHint } = computeSetAState({
        canonical,
        semesterLocked,
        classEnded,
        hasAttendance: !!att,
      });

      rows.push({
        studentId: st.id,
        studentName: st.name,
        sessionId: session.id,
        disciplineLabel: formatDisciplineLabel({
          disciplineId: session.disciplineId,
          disciplineName: session.discipline?.name,
        }),
        startTime: session.startTime,
        endTime: session.endTime,
        dateLabel: formatInTimeZone(session.startTime, BISHKEK_TIME_ZONE, "dd.MM.yyyy"),
        timeLabel: `${formatInTimeZone(session.startTime, BISHKEK_TIME_ZONE, "HH:mm")}–${formatInTimeZone(session.endTime, BISHKEK_TIME_ZONE, "HH:mm")}`,
        statusLabel,
        attendanceId: att?.id ?? null,
        canSetA,
        semesterLocked,
        actionHint,
      });
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900 }}>Освобождения • {group.name}</h1>
          <div style={{ marginTop: 6, color: "#6b7280", fontWeight: 600 }}>
            Справки Б (B_PENDING и B_CONFIRMED) за текущий семестр; ниже — полная сетка по выбранному дню для выставления А.
            {semester?.endDate ? (
              <span>
                {" "}
                Семестр до {new Date(semester.endDate).toLocaleDateString("ru-RU")}; пока семестр не закрыт, доступно изменение там,
                где это позволяют правила статусов.
              </span>
            ) : null}
          </div>
        </div>
        <Link href="/curator/exemptions" style={{ fontWeight: 800 }}>
          К списку групп
        </Link>
      </div>

      <form method="get" style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
          Дата
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", fontWeight: 700 }}
          />
        </label>
        <button
          type="submit"
          style={{
            borderRadius: 12,
            padding: "10px 14px",
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Показать
        </button>
      </form>

      {semester?.isLocked ? (
        <div style={{ marginTop: 12, color: "#991b1b", fontWeight: 800 }}>Семестр заблокирован — выставление А недоступно.</div>
      ) : null}

      <div style={{ marginTop: 20, fontWeight: 900, fontSize: 16 }}>Справки Б за семестр (B_PENDING, B_CONFIRMED)</div>
      <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "white" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <th style={{ padding: "10px 8px" }}>Студент</th>
              <th style={{ padding: "10px 8px" }}>Занятие</th>
              <th style={{ padding: "10px 8px" }}>Дата</th>
              <th style={{ padding: "10px 8px" }}>Статус</th>
              <th style={{ padding: "10px 8px" }}>А</th>
            </tr>
          </thead>
          <tbody>
            {sickSemesterRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 14, color: "#6b7280", fontWeight: 700 }}>
                  В текущем семестре нет отметок B_PENDING или B_CONFIRMED по этой группе.
                </td>
              </tr>
            ) : (
              sickSemesterRows.map((r) => (
                <tr key={`sick:${r.attendanceId}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 800 }}>{r.studentName}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {r.disciplineLabel}
                    <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{r.timeLabel}</div>
                  </td>
                  <td style={{ padding: "10px 8px" }}>{r.dateLabel}</td>
                  <td style={{ padding: "10px 8px", fontWeight: 700 }}>{r.statusLabel}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {r.statusLabel === "A" ? (
                      <span style={{ color: "#16a34a", fontWeight: 800 }}>А</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <SetAdministrativeAbsenceButton attendanceId={r.attendanceId!} disabled={!r.canSetA} />
                        {r.actionHint ? (
                          <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>{r.actionHint}</span>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 24, fontWeight: 900, fontSize: 16 }}>Все занятия за выбранный день</div>
      <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "white" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <th style={{ padding: "10px 8px" }}>Студент</th>
              <th style={{ padding: "10px 8px" }}>Занятие</th>
              <th style={{ padding: "10px 8px" }}>Дата</th>
              <th style={{ padding: "10px 8px" }}>Статус</th>
              <th style={{ padding: "10px 8px" }}>А</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 14, color: "#6b7280", fontWeight: 700 }}>
                  На выбранную дату занятий нет.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.studentId}:${r.sessionId}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 800 }}>{r.studentName}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {r.disciplineLabel}
                    <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{r.timeLabel}</div>
                  </td>
                  <td style={{ padding: "10px 8px" }}>{r.dateLabel}</td>
                  <td style={{ padding: "10px 8px", fontWeight: 700 }}>{r.statusLabel}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {!r.attendanceId ? (
                      <span style={{ color: "#6b7280", fontSize: 13 }}>Нет записи посещаемости</span>
                    ) : r.statusLabel === "A" ? (
                      <span style={{ color: "#16a34a", fontWeight: 800 }}>А</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <SetAdministrativeAbsenceButton attendanceId={r.attendanceId} disabled={!r.canSetA} />
                        {r.actionHint ? (
                          <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 600 }}>{r.actionHint}</span>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
