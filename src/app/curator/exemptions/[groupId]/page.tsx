import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { BISHKEK_TIME_ZONE } from "@/lib/time/bishkek-now";
import { formatAttendanceStatusDisplay, formatDisciplineLabel } from "@/lib/ui/labels";
import { getCanonicalAttendanceStatusV2 } from "@/lib/attendance/status-machine";

import { DateInputWithApply } from "../auto-submit-date-input";
import { ToggleExemptionsAButton } from "../toggle-exemptions-a-button";

function parseYmd(param: string | undefined): string | null {
  if (!param || typeof param !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(param.trim());
  return m ? param.trim() : null;
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
      select: { id: true, isLocked: true },
    })) ??
    (await prisma.semester.findFirst({
      orderBy: { startDate: "desc" },
      select: { id: true, isLocked: true },
    }));

  const sessions =
    semester?.id
      ? await prisma.classSession.findMany({
          where: {
            groupId,
            semesterId: semester.id,
            isActive: true,
            deletedAt: null,
            OR: [{ statusV2: { not: "cancelled" } }, { statusV2: null, status: { not: "cancelled" } }],
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

  const nowMs = Date.now();
  const currentSessionId =
    selectedDate === todayYmd
      ? (sessionsOnDay.find((x) => nowMs >= x.startTime.getTime() && nowMs < x.endTime.getTime()) ??
          sessionsOnDay.find((x) => x.startTime.getTime() > nowMs))?.id ?? null
      : null;

  const attendanceByKey = new Map(attendances.map((a) => [`${a.studentId}:${a.classSessionId}`, a] as const));

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Освобождения • {group.name}</h1>
      </div>

      <form method="get" style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
          Дата
          <DateInputWithApply defaultValue={selectedDate} />
        </label>
      </form>

      {semester?.isLocked ? (
        <div style={{ marginTop: 12, color: "#991b1b", fontWeight: 800 }}>Семестр заблокирован — выставление А недоступно.</div>
      ) : null}

      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Занятия за выбранный день</div>
        {currentSessionId ? (
          <a href="#current" style={{ fontWeight: 800, fontSize: 14, color: "#1d4ed8" }}>
            К текущему занятию
          </a>
        ) : null}
      </div>
      <div style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>
        Нажмите «Поставить А» у студента на нужном занятии. «Снять А» отменяет освобождение. Преподаватель освобождение изменить не может.
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
        {sessionsOnDay.length === 0 || students.length === 0 ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, color: "#6b7280", fontWeight: 700, background: "white" }}>
            На выбранную дату занятий нет.
          </div>
        ) : (
          sessionsOnDay.map((session) => {
            const isOngoing = nowMs >= session.startTime.getTime() && nowMs < session.endTime.getTime();
            const isCurrent = session.id === currentSessionId;
            const semesterLocked = !!session.semester?.isLocked || !!semester?.isLocked;
            return (
              <section
                key={session.id}
                id={isCurrent ? "current" : undefined}
                style={{ border: `1px solid ${isCurrent ? "#93c5fd" : "#e5e7eb"}`, borderRadius: 14, background: "white", overflow: "hidden", scrollMarginTop: 80 }}
              >
                <div style={{ padding: "10px 12px", background: isCurrent ? "#eff6ff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900 }}>
                      {`${formatInTimeZone(session.startTime, BISHKEK_TIME_ZONE, "HH:mm")}–${formatInTimeZone(session.endTime, BISHKEK_TIME_ZONE, "HH:mm")}`}
                    </div>
                    {isOngoing ? <span style={{ fontSize: 12, fontWeight: 800, color: "#166534" }}>Идёт сейчас</span> : null}
                  </div>
                  <div style={{ color: "#374151", fontSize: 14 }}>
                    {formatDisciplineLabel({ disciplineId: session.disciplineId, disciplineName: session.discipline?.name })}
                  </div>
                </div>
                <div>
                  {students.map((st) => {
                    const att = attendanceByKey.get(`${st.id}:${session.id}`) ?? null;
                    const canonical = att ? getCanonicalAttendanceStatusV2({ statusV2: att.statusV2, status: att.status }) : null;
                    const statusLabel = att ? formatAttendanceStatusDisplay({ statusV2: att.statusV2, status: att.status }) : "не отмечен";
                    return (
                      <div
                        key={st.id}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #f3f4f6" }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800 }}>{st.name}</div>
                          <div style={{ color: "#6b7280", fontSize: 12 }}>Статус: {statusLabel}</div>
                        </div>
                        <ToggleExemptionsAButton
                          classSessionId={session.id}
                          studentId={st.id}
                          disabled={semesterLocked}
                          isActive={canonical === "A"}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
