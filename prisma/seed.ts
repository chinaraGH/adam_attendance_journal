import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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

