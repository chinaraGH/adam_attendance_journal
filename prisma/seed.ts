import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Cleanup for repeatable seed in prototype environment.
  await prisma.attendance.deleteMany({});
  await prisma.classSession.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.userGroupCurator.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.discipline.deleteMany({});
  await prisma.teacher.deleteMany({});
  await prisma.program.deleteMany({});
  await prisma.faculty.deleteMany({});
  await prisma.semester.deleteMany({});
  await prisma.user.deleteMany({});

  const now = new Date();

  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const lockedSemester = await prisma.semester.create({
    data: {
      id: "SEMESTER_LOCKED",
      name: "Осенний семестр (закрыт)",
      startDate: new Date(startOfToday.getTime() - 140 * dayMs),
      endDate: new Date(startOfToday.getTime() - 20 * dayMs),
      isLocked: true,
      lockedAt: new Date(startOfToday.getTime() - 19 * dayMs),
    },
    select: { id: true },
  });

  const activeSemester = await prisma.semester.create({
    data: {
      id: "SEMESTER_ACTIVE",
      name: "Весенний семестр (активный)",
      startDate: new Date(startOfToday.getTime() - 15 * dayMs),
      endDate: new Date(startOfToday.getTime() + 60 * dayMs),
      isLocked: false,
      lockedAt: null,
    },
    select: { id: true },
  });

  const faculty1 = await prisma.faculty.create({
    data: { name: "Факультет информационных технологий", code: "FIT" },
    select: { id: true },
  });
  const faculty2 = await prisma.faculty.create({
    data: { name: "Факультет экономики и управления", code: "FEU" },
    select: { id: true },
  });

  const programs = await prisma.$transaction([
    prisma.program.create({
      data: { facultyId: faculty1.id, name: "Программная инженерия", code: "SE" },
      select: { id: true, facultyId: true, code: true },
    }),
    prisma.program.create({
      data: { facultyId: faculty1.id, name: "Информационные системы", code: "IS" },
      select: { id: true, facultyId: true, code: true },
    }),
    prisma.program.create({
      data: { facultyId: faculty2.id, name: "Финансы", code: "FIN" },
      select: { id: true, facultyId: true, code: true },
    }),
    prisma.program.create({
      data: { facultyId: faculty2.id, name: "Менеджмент", code: "MGT" },
      select: { id: true, facultyId: true, code: true },
    }),
  ]);

  const ensureUser = async (id: string, role: string) => {
    await prisma.user.create({
      data: { id, role, isActive: true, deletedAt: null },
      select: { id: true },
    });
  };

  await ensureUser("CURATOR_TEST", "CURATOR");
  await ensureUser("TEACHER_TEST", "TEACHER");
  await ensureUser("TEACHER_2", "TEACHER");
  await ensureUser("TEACHER_3", "TEACHER");
  await ensureUser("TEACHER_4", "TEACHER");
  await ensureUser("ACADEMIC_OFFICE_TEST", "ACADEMIC_OFFICE");
  await ensureUser("ADMIN_TEST", "ADMIN");
  await ensureUser("LEADERSHIP_TEST", "LEADERSHIP");

  await prisma.teacher.createMany({
    data: [
      { id: "TEACHER_TEST", gaudiId: "GAUDI_TEACHER_001", name: "Алиев Азамат" },
      { id: "TEACHER_2", gaudiId: "GAUDI_TEACHER_002", name: "Садыкова Айжан" },
      { id: "TEACHER_3", gaudiId: "GAUDI_TEACHER_003", name: "Иванов Сергей" },
      { id: "TEACHER_4", gaudiId: "GAUDI_TEACHER_004", name: "Ким Диана" },
    ],
  });

  const disciplines = await prisma.$transaction([
    prisma.discipline.create({ data: { name: "Базы данных", code: "DB", programId: programs[0].id }, select: { id: true } }),
    prisma.discipline.create({ data: { name: "Веб-разработка", code: "WEB", programId: programs[0].id }, select: { id: true } }),
    prisma.discipline.create({ data: { name: "Алгоритмы", code: "ALG", programId: programs[1].id }, select: { id: true } }),
    prisma.discipline.create({ data: { name: "Эконометрика", code: "ECM", programId: programs[2].id }, select: { id: true } }),
    prisma.discipline.create({ data: { name: "Основы менеджмента", code: "MGT101", programId: programs[3].id }, select: { id: true } }),
  ]);

  // 10–15 групп, распределим по программам.
  const groupCount = 12;
  const groups = [];
  for (let i = 0; i < groupCount; i++) {
    const program = programs[i % programs.length];
    const year = 2023 + (i % 3);
    const code = `${program.code}-${String(i + 1).padStart(2, "0")}`;
    const g = await prisma.group.create({
      data: {
        gaudiId: `GAUDI_GROUP_${code}`,
        name: `Группа ${code}`,
        code,
        programId: program.id,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, code: true },
    });
    groups.push(g);
  }

  // Привяжем куратора к части групп (для реалистики).
  await prisma.userGroupCurator.createMany({
    data: groups.slice(0, 6).map((g) => ({
      userId: "CURATOR_TEST",
      groupId: g.id,
      isActive: true,
      deletedAt: null,
    })),
  });

  // ~300 студентов.
  const lastNames = [
    "Асанов",
    "Иванова",
    "Султанов",
    "Ким",
    "Абдрахманов",
    "Петрова",
    "Осмонова",
    "Турсунов",
    "Садыков",
    "Муратова",
    "Жумабеков",
    "Насырова",
  ];
  const firstNames = [
    "Азамат",
    "Алина",
    "Нурбек",
    "Диана",
    "Бектур",
    "Софья",
    "Айжан",
    "Сергей",
    "Айбек",
    "Мээрим",
    "Каныкей",
    "Тимур",
  ];

  const studentsToCreate: Array<{ gaudiId: string; groupId: string; name: string; isActive: boolean; deletedAt: null }> = [];
  for (let i = 0; i < 300; i++) {
    const g = groups[i % groups.length]!;
    const ln = lastNames[i % lastNames.length]!;
    const fn = firstNames[(i * 7) % firstNames.length]!;
    const name = `${ln} ${fn}`;
    studentsToCreate.push({
      gaudiId: `GAUDI_STUDENT_${String(i + 1).padStart(4, "0")}`,
      groupId: g.id,
      name,
      isActive: true,
      deletedAt: null,
    });
  }
  await prisma.student.createMany({ data: studentsToCreate });

  // Календарь текущей недели: создадим занятия на 5 рабочих дней.
  // Упрощение: используем локальное время окружения, но в проекте вся логика далее завязана на UTC+6.
  const weekdayStart = new Date(startOfToday);
  const day = weekdayStart.getDay(); // 0=Sun
  const diffToMon = (day + 6) % 7;
  weekdayStart.setDate(weekdayStart.getDate() - diffToMon);

  const teacherIds = ["TEACHER_TEST", "TEACHER_2", "TEACHER_3", "TEACHER_4"] as const;

  const sessions: Array<{ id: string; groupId: string; semesterId: string }> = [];

  let seq = 0;
  for (let d = 0; d < 5; d++) {
    for (let slot = 0; slot < 3; slot++) {
      const start = new Date(weekdayStart.getTime() + d * dayMs);
      start.setHours(9 + slot * 2, 0, 0, 0);
      const end = new Date(start.getTime() + 90 * 60 * 1000);

      const group = groups[(d * 3 + slot) % groups.length]!;
      const teacherId = teacherIds[(d + slot) % teacherIds.length]!;
      const discipline = disciplines[(d + slot) % disciplines.length]!;

      const scheduleExternalId = `SCHEDULE_${d}_${slot}_${group.code}`;
      const cs = await prisma.classSession.create({
        data: {
          scheduleExternalId,
          gaudiId: null,
          disciplineId: discipline.id,
          groupId: group.id,
          teacherId,
          semesterId: activeSemester.id,
          startTime: start,
          endTime: end,
          status: "scheduled",
          statusV2: "scheduled",
          openedAt: null,
          flagLateTeacher: false,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, groupId: true, semesterId: true },
      });
      sessions.push(cs);
      seq++;
    }
  }

  // Специальные кейсы:
  // 1) Активное занятие "прямо сейчас".
  const activeSession = await prisma.classSession.create({
    data: {
      scheduleExternalId: "SCHEDULE_ACTIVE_NOW",
      gaudiId: null,
      disciplineId: disciplines[0]!.id,
      groupId: groups[0]!.id,
      teacherId: "TEACHER_TEST",
      semesterId: activeSemester.id,
      startTime: new Date(now.getTime() - 20 * 60 * 1000),
      endTime: new Date(now.getTime() + 40 * 60 * 1000),
      status: "scheduled",
      statusV2: "scheduled",
      openedAt: new Date(now.getTime() - 10 * 60 * 1000),
      flagLateTeacher: false,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, groupId: true, semesterId: true },
  });

  // 2) Завершённое занятие с B_PENDING (нужно подтверждение куратора).
  const pendingSession = await prisma.classSession.create({
    data: {
      scheduleExternalId: "SCHEDULE_FINISHED_WITH_B_PENDING",
      gaudiId: null,
      disciplineId: disciplines[1]!.id,
      groupId: groups[1]!.id,
      teacherId: "TEACHER_2",
      semesterId: activeSemester.id,
      startTime: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      status: "scheduled",
      statusV2: "scheduled",
      openedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000 + 5 * 60 * 1000),
      flagLateTeacher: false,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, groupId: true, semesterId: true },
  });

  // 3) Занятие в закрытом семестре с любыми статусами (любые правки запрещены).
  const lockedSemesterSession = await prisma.classSession.create({
    data: {
      scheduleExternalId: "SCHEDULE_LOCKED_SEMESTER",
      gaudiId: null,
      disciplineId: disciplines[2]!.id,
      groupId: groups[2]!.id,
      teacherId: "TEACHER_3",
      semesterId: lockedSemester.id,
      startTime: new Date(startOfToday.getTime() - 30 * dayMs),
      endTime: new Date(startOfToday.getTime() - 30 * dayMs + 90 * 60 * 1000),
      status: "finished",
      statusV2: "finished",
      openedAt: new Date(startOfToday.getTime() - 30 * dayMs + 5 * 60 * 1000),
      flagLateTeacher: false,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, groupId: true, semesterId: true },
  });

  // Attendance rows: проставим для 3 ключевых занятий + немного для недельных.
  const group0Students = await prisma.student.findMany({
    where: { groupId: groups[0]!.id, isActive: true, deletedAt: null },
    select: { id: true },
    take: 25,
  });
  const group1Students = await prisma.student.findMany({
    where: { groupId: groups[1]!.id, isActive: true, deletedAt: null },
    select: { id: true },
    take: 25,
  });
  const group2Students = await prisma.student.findMany({
    where: { groupId: groups[2]!.id, isActive: true, deletedAt: null },
    select: { id: true },
    take: 25,
  });

  await prisma.attendance.createMany({
    data: group0Students.map((st, idx) => ({
      classSessionId: activeSession.id,
      studentId: st.id,
      semesterId: activeSession.semesterId,
      status: idx % 10 === 0 ? "O" : "P",
      statusV2: idx % 10 === 0 ? "O" : "P",
      updatedBy: "seed",
      isActive: true,
      deletedAt: null,
    })),
  });

  await prisma.attendance.createMany({
    data: group1Students.map((st, idx) => ({
      classSessionId: pendingSession.id,
      studentId: st.id,
      semesterId: pendingSession.semesterId,
      status: idx % 12 === 0 ? "B_PENDING" : idx % 7 === 0 ? "NB" : "P",
      statusV2: idx % 12 === 0 ? "B_PENDING" : idx % 7 === 0 ? "NB" : "P",
      updatedBy: "seed",
      isActive: true,
      deletedAt: null,
    })),
  });

  await prisma.attendance.createMany({
    data: group2Students.map((st, idx) => ({
      classSessionId: lockedSemesterSession.id,
      studentId: st.id,
      semesterId: lockedSemesterSession.semesterId,
      status: idx % 8 === 0 ? "A" : "P",
      statusV2: idx % 8 === 0 ? "A" : "P",
      updatedBy: "seed",
      isActive: true,
      deletedAt: null,
    })),
  });

  // Немного недельных занятий, чтобы были данные для отчетов.
  const weeklySeedSessions = sessions.slice(0, 10);
  for (const s of weeklySeedSessions) {
    const st = await prisma.student.findMany({
      where: { groupId: s.groupId, isActive: true, deletedAt: null },
      select: { id: true },
      take: 20,
    });
    await prisma.attendance.createMany({
      data: st.map((x, i) => ({
        classSessionId: s.id,
        studentId: x.id,
        semesterId: s.semesterId,
        status: i % 9 === 0 ? "NB" : "P",
        statusV2: i % 9 === 0 ? "NB" : "P",
        updatedBy: "seed",
        isActive: true,
        deletedAt: null,
      })),
    });
  }

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

  // Keep legacy test IDs out of the way (prototype-only seed now builds the whole structure above).
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

