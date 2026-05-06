import { prisma } from "@/lib/prisma";
import { getEffectiveClassSessionStatus } from "@/lib/class-session/effective-status";
import { openJournal } from "@/app/actions/class-session-actions";
import { formatClassSessionStatusLabel, formatDisciplineLabel } from "@/lib/ui/labels";
import { BackToolbar, ExitButton } from "@/components/exit-button";

import { AttendanceClient } from "../attendance-client";

export default async function AttendanceBySessionPage(props: { params: { classSessionId: string } }) {
  const { classSessionId } = props.params;

  const session = await prisma.classSession.findFirst({
    where: { id: classSessionId, isActive: true, deletedAt: null },
    select: {
      id: true,
      disciplineId: true,
      startTime: true,
      endTime: true,
      openedAt: true,
      status: true,
      statusV2: true,
      outOfSemester: true,
      discipline: { select: { name: true } },
      semester: { select: { isLocked: true } },
      group: {
        select: {
          id: true,
          name: true,
          students: {
            where: { isActive: true, deletedAt: null },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!session) {
    return (
      <main style={{ padding: 24, maxWidth: 820, margin: "0 auto" }}>
        <BackToolbar style={{ marginBottom: 16 }}>
          <ExitButton to="/teacher" preferTo />
        </BackToolbar>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Журнал</h1>
        <p style={{ marginTop: 12 }}>Занятие не найдено.</p>
      </main>
    );
  }

  const effective = getEffectiveClassSessionStatus({
    startTime: session.startTime,
    endTime: session.endTime,
    openedAt: session.openedAt,
    status: session.status,
    statusV2: session.statusV2,
  });

  // If someone navigates after end_time and openedAt was NULL,
  // the session is effectively auto-closed: convert remaining NULLs to "S".
  if (effective === "auto_closed") {
    const updated = await prisma.attendance.updateMany({
      where: {
        classSessionId: session.id,
        isActive: true,
        deletedAt: null,
        AND: [{ statusV2: null }, { status: null }],
      },
      data: { statusV2: "S", status: "S", updatedBy: "system:auto-closed" },
    });

    if (updated.count > 0) {
      await prisma.auditTrail.create({
        data: {
          actorType: "system",
          actorId: null,
          action: "auto_null_to_S",
          entityType: "ClassSession",
          entityId: session.id,
          beforeJson: JSON.stringify({ convertedNullCount: 0 }),
          afterJson: JSON.stringify({ convertedNullCount: updated.count }),
        },
        select: { id: true },
      });
    }
  }

  // Open journal only if active; it must set openedAt only once.
  if (effective === "active") {
    await openJournal({ classSessionId: session.id });
  }

  const initialStatusByStudentId: Record<string, string | null> = {};
  const rows = await prisma.attendance.findMany({
    where: {
      classSessionId: session.id,
      isActive: true,
      deletedAt: null,
      studentId: { in: session.group.students.map((s) => s.id) },
    },
    select: { studentId: true, statusV2: true, status: true },
  });
  for (const r of rows) {
    initialStatusByStudentId[r.studentId] = r.statusV2 ?? r.status ?? null;
  }

  const isReadOnly = effective === "finished" || effective === "auto_closed" || effective === "cancelled" || !!session.semester?.isLocked;
  const sessionAudit = await prisma.auditTrail.findMany({
    where: {
      entityType: "ClassSession",
      entityId: session.id,
      action: {
        in: [
          "class_session_semester_resolution_update",
          "class_session_semester_resolution_reconciled",
          "class_session_cancel",
          "class_session_restore",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, createdAt: true, action: true, afterJson: true },
  });

  return (
    <main style={{ padding: 24, maxWidth: 820, margin: "0 auto" }}>
      <AttendanceClient
        header={
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Журнал посещаемости</h1>
              <div style={{ color: "#111827", fontWeight: 900, fontSize: 18, marginTop: 4 }}>
                {formatDisciplineLabel({ disciplineId: session.disciplineId, disciplineName: session.discipline?.name })}
              </div>
              <div style={{ color: "#374151", fontWeight: 900, fontSize: 16, marginTop: 2 }}>{session.group.name}</div>
              <div style={{ color: "#6b7280", marginTop: 4 }}>
                Статус: <span style={{ fontWeight: 800 }}>{formatClassSessionStatusLabel(effective)}</span>
              </div>
              <div style={{ color: session.outOfSemester ? "#92400e" : "#047857", marginTop: 4, fontWeight: 800 }}>
                Семестровый статус: {session.outOfSemester ? "Вне семестров" : "В семестре"}
              </div>
              {session.semester?.isLocked ? (
                <div style={{ marginTop: 6, color: "#991b1b", fontWeight: 900 }}>
                  Семестр заблокирован — изменения запрещены.
                </div>
              ) : null}
            </div>
          </div>
        }
        students={session.group.students}
        initialStatusByStudentId={initialStatusByStudentId}
        classSessionId={session.id}
        readOnly={isReadOnly}
      />
      <section style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>История статуса занятия</div>
        {sessionAudit.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>Записи аудита отсутствуют.</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {sessionAudit.map((item) => (
              <li key={item.id} style={{ border: "1px solid #f3f4f6", borderRadius: 10, padding: "8px 10px", fontSize: 13 }}>
                <strong>{item.action}</strong> — {new Date(item.createdAt).toLocaleString("ru-RU")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

