import { prisma } from "@/lib/prisma";

import { AttendanceClient } from "./attendance-client";

const TEST_GROUP_GAUDI_ID = "GAUDI_GROUP_INFORMATICS_TEST";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const group = await prisma.group.findFirst({
    where: { gaudiId: TEST_GROUP_GAUDI_ID, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      students: {
        where: { isActive: true, deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });

  const session = await prisma.classSession.findFirst({
    where: { isActive: true, deletedAt: null, ...(group ? { groupId: group.id } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const anySession =
    session ??
    (await prisma.classSession.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }));

  const initialStatusByStudentId: Record<string, string | null> = {};
  if (group && anySession) {
    const rows = await prisma.attendance.findMany({
      where: {
        classSessionId: anySession.id,
        isActive: true,
        deletedAt: null,
        studentId: { in: group.students.map((s) => s.id) },
      },
      select: { studentId: true, status: true },
    });
    for (const r of rows) {
      initialStatusByStudentId[r.studentId] = r.status;
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Электронный журнал</h1>

      {!group ? (
        <p>Тестовая группа не найдена.</p>
      ) : !anySession ? (
        <p>Нет ни одного занятия (ClassSession) в базе. Создайте тестовое занятие и обновите страницу.</p>
      ) : (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{group.name}</h2>

          <AttendanceClient
            students={group.students}
            initialStatusByStudentId={initialStatusByStudentId}
            classSessionId={anySession.id}
          />
        </>
      )}
    </main>
  );
}

