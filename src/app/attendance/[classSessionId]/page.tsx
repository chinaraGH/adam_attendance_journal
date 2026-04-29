import { prisma } from "@/lib/prisma";
import { getEffectiveClassSessionStatus } from "@/lib/class-session/effective-status";
import { openJournal } from "@/app/actions/class-session-actions";
import { formatClassSessionStatusLabel, formatDisciplineLabel } from "@/lib/ui/labels";
import { ExitButton } from "@/components/exit-button";

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
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Журнал</h1>
        <p style={{ marginTop: 12 }}>Занятие не найдено.</p>
        <div style={{ marginTop: 12 }}>
          <ExitButton />
        </div>
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

  return (
    <main style={{ padding: 24, maxWidth: 820, margin: "0 auto" }}>
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
          {session.semester?.isLocked ? (
            <div style={{ marginTop: 6, color: "#991b1b", fontWeight: 900 }}>
              Семестр заблокирован — изменения запрещены.
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <AttendanceClient
          students={session.group.students}
          initialStatusByStudentId={initialStatusByStudentId}
          classSessionId={session.id}
          readOnly={isReadOnly}
        />
      </div>
    </main>
  );
}

