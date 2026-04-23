import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.semester.upsert({
    where: { id: "SEMESTER_TEST" },
    update: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isLocked: false,
      lockedAt: null,
    },
    create: {
      id: "SEMESTER_TEST",
      name: "Тестовый семестр",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isLocked: false,
      lockedAt: null,
    },
    select: { id: true },
  });

  const group = await prisma.group.upsert({
    where: { gaudiId: "GAUDI_GROUP_INFORMATICS_TEST" },
    update: {
      name: "Информатика",
      isActive: true,
      deletedAt: null,
    },
    create: {
      gaudiId: "GAUDI_GROUP_INFORMATICS_TEST",
      name: "Информатика",
      code: "INF-TEST",
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  await prisma.user.upsert({
    where: { id: "CURATOR_TEST" },
    update: { role: "CURATOR", isActive: true, deletedAt: null },
    create: { id: "CURATOR_TEST", role: "CURATOR", isActive: true, deletedAt: null },
  });
  await prisma.userGroupCurator.upsert({
    where: { userId_groupId: { userId: "CURATOR_TEST", groupId: group.id } },
    update: { isActive: true, deletedAt: null },
    create: { userId: "CURATOR_TEST", groupId: group.id, isActive: true, deletedAt: null },
    select: { id: true },
  });

  const students = [
    { gaudiId: "GAUDI_STUDENT_TEST_001", name: "Асанов Азамат" },
    { gaudiId: "GAUDI_STUDENT_TEST_002", name: "Иванова Алина" },
    { gaudiId: "GAUDI_STUDENT_TEST_003", name: "Султанов Нурбек" },
    { gaudiId: "GAUDI_STUDENT_TEST_004", name: "Ким Диана" },
    { gaudiId: "GAUDI_STUDENT_TEST_005", name: "Абдрахманов Бектур" },
    { gaudiId: "GAUDI_STUDENT_TEST_006", name: "Петрова Софья" },
  ] as const;

  await prisma.$transaction(
    students.map((student) =>
      prisma.student.upsert({
        where: { gaudiId: student.gaudiId },
        update: {
          groupId: group.id,
          name: student.name,
          isActive: true,
          deletedAt: null,
        },
        create: {
          gaudiId: student.gaudiId,
          groupId: group.id,
          name: student.name,
          isActive: true,
          deletedAt: null,
        },
      }),
    ),
  );

  await prisma.classSession.upsert({
    where: { scheduleExternalId: "SCHEDULE_TEST_SESSION_INFORMATICS" },
    update: {
      groupId: group.id,
      status: "active",
      isActive: true,
      deletedAt: null,
    },
    create: {
      scheduleExternalId: "SCHEDULE_TEST_SESSION_INFORMATICS",
      disciplineId: "DISCIPLINE_TEST",
      groupId: group.id,
      teacherId: "TEACHER_TEST",
      semesterId: "SEMESTER_TEST",
      startTime: new Date(Date.now() - 20 * 60 * 1000),
      endTime: new Date(Date.now() + 40 * 60 * 1000),
      status: "active",
      isActive: true,
      deletedAt: null,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

