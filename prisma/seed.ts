import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Cleanup for repeatable seed in prototype environment.
  await prisma.attendance.deleteMany({});
  await prisma.classSession.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.userGroupCurator.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.disciplineProgram.deleteMany({});
  await prisma.discipline.deleteMany({});
  await prisma.teacher.deleteMany({});
  await prisma.program.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.faculty.deleteMany({});
  await prisma.semester.deleteMany({});
  await prisma.appUser.deleteMany({});

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Semester (required by ClassSession)
  const semester = await prisma.semester.create({
    data: {
      id: "SEM26SP",
      name: "Весна 2026",
      startDate: new Date(startOfToday.getTime() - 30 * dayMs),
      endDate: new Date(startOfToday.getTime() + 120 * dayMs),
      isLocked: false,
      lockedAt: null,
    },
    select: { id: true },
  });

  // Faculties
  const facEmt = await prisma.faculty.create({
    data: { id: "FACEMT", name: "Экономика, менеджмент и туризм", code: "EMT" },
    select: { id: true },
  });
  const facIto = await prisma.faculty.create({
    data: { id: "FACITO", name: "Информационные технологии и общеобразовательные дисциплины", code: "ITO" },
    select: { id: true },
  });

  // Departments (кафедры)
  const depIto = await prisma.department.create({
    data: { id: "DEPITO", facultyId: facIto.id, name: "Информационные технологии и общеобразовательные дисциплины", code: "ITO" },
    select: { id: true },
  });
  const depEmt = await prisma.department.create({
    data: { id: "DEPEMT", facultyId: facEmt.id, name: "Экономика, менеджмент и туризм", code: "EMT" },
    select: { id: true },
  });

  // Programs (направления)
  const prgEco = await prisma.program.create({
    data: { id: "PRGECO", facultyId: facEmt.id, departmentId: depEmt.id, name: "Экономика", code: "ECO" },
    select: { id: true },
  });
  const prgBiz = await prisma.program.create({
    data: { id: "PRGBIZ", facultyId: facEmt.id, departmentId: depEmt.id, name: "Управление бизнесом", code: "BIZ" },
    select: { id: true },
  });
  const prgIst = await prisma.program.create({
    data: { id: "PRGIST", facultyId: facIto.id, departmentId: depIto.id, name: "Информационные системы и технологии", code: "IST" },
    select: { id: true },
  });

  // Groups
  const groups = await prisma.$transaction([
    prisma.group.create({
      data: { id: "GIST525", gaudiId: "GGIST25", programId: prgIst.id, name: "ИСТ-5-25", code: "ИСТ-5-25", isActive: true, deletedAt: null },
      select: { id: true },
    }),
    prisma.group.create({
      data: { id: "GIST524", gaudiId: "GGIST24", programId: prgIst.id, name: "ИСТ-5-24", code: "ИСТ-5-24", isActive: true, deletedAt: null },
      select: { id: true },
    }),
    prisma.group.create({
      data: { id: "GUB423", gaudiId: "GGUB423", programId: prgBiz.id, name: "УБ-4-23", code: "УБ-4-23", isActive: true, deletedAt: null },
      select: { id: true },
    }),
    prisma.group.create({
      data: { id: "GE123", gaudiId: "GGE123", programId: prgEco.id, name: "Э-1-23", code: "Э-1-23", isActive: true, deletedAt: null },
      select: { id: true },
    }),
    prisma.group.create({
      data: { id: "GE124", gaudiId: "GGE124", programId: prgEco.id, name: "Э-1-24", code: "Э-1-24", isActive: true, deletedAt: null },
      select: { id: true },
    }),
    prisma.group.create({
      data: { id: "GM225", gaudiId: "GGM225", programId: prgBiz.id, name: "М-2-25", code: "М-2-25", isActive: true, deletedAt: null },
      select: { id: true },
    }),
  ]);

  const groupById = new Map(groups.map((g) => [g.id, g]));

  // Teachers + Users (IDs <= 8)
  const teachers: Array<{ id: string; name: string; gaudiId: string | null }> = [
    { id: "TIVANOV", name: "Иванов Сергей Николаевич", gaudiId: "GAIVANV" },
    { id: "TPETEV", name: "Петрова Елена Викторовна", gaudiId: "GAPETEV" },
    { id: "TSIDAP", name: "Сидоров Алексей Петрович", gaudiId: "GASIDAP" },
    { id: "TKUZOL", name: "Кузнецова Ольга Игоревна", gaudiId: "GAKUZOL" },
    { id: "TMIKDA", name: "Михайлов Дмитрий Артемович", gaudiId: "GAMIKDA" },
    { id: "TVASANS", name: "Васильева Анна Сергеевна", gaudiId: "GAVASAN" },
    { id: "TBELMAX", name: "Белов Максим Александрович", gaudiId: "GABELMX" },
    { id: "TSOKNV", name: "Соколова Наталья Владимировна", gaudiId: "GASOKNV" },
    { id: "TDMITIG", name: "Дмитриев Игорь Борисович", gaudiId: "GADMTIG" },
    { id: "TMOROEK", name: "Морозова Екатерина Дмитриевна", gaudiId: "GAMOREK" },
    { id: "TVOLAND", name: "Волков Андрей Юрьевич", gaudiId: "GAVLAND" },
    { id: "TNIKSV", name: "Николаева Светлана Юрьевна", gaudiId: "GANIKSV" },
    { id: "TPAVLAS", name: "Павлов Артем Сергеевич", gaudiId: "GAPAVAS" },
  ];

  await prisma.appUser.createMany({
    data: teachers.map((t) => ({ id: t.id, role: "TEACHER", isActive: true, deletedAt: null })),
    skipDuplicates: true,
  });
  await prisma.teacher.createMany({
    data: teachers.map((t) => ({ id: t.id, gaudiId: t.gaudiId, name: t.name, email: null, isActive: true, deletedAt: null })),
    skipDuplicates: true,
  });

  // Disciplines (one "Информатика" record; different teachers -> different ClassSession rows)
  const dInformat = await prisma.discipline.create({
    data: { id: "DINF", name: "Информатика", code: "INF", departmentId: depIto.id, isActive: true, deletedAt: null },
    select: { id: true },
  });
  const dHistEco = await prisma.discipline.create({
    data: { id: "DHISECO", name: "История экономики", code: "HISECO", departmentId: depEmt.id, isActive: true, deletedAt: null },
    select: { id: true },
  });
  const dMgmt = await prisma.discipline.create({
    data: { id: "DMNG", name: "Менеджмент", code: "MNG", departmentId: depEmt.id, isActive: true, deletedAt: null },
    select: { id: true },
  });
  const dDesign = await prisma.discipline.create({
    data: { id: "DDESIGN", name: "Дизайн мышления", code: "DESIGN", departmentId: depIto.id, isActive: true, deletedAt: null },
    select: { id: true },
  });
  const dDb = await prisma.discipline.create({
    data: { id: "DDB", name: "Базы данных", code: "DB", departmentId: depIto.id, isActive: true, deletedAt: null },
    select: { id: true },
  });
  const dEng = await prisma.discipline.create({
    data: { id: "DENG", name: "Английский язык", code: "ENG", departmentId: depIto.id, isActive: true, deletedAt: null },
    select: { id: true },
  });

  const dp: Array<{ id: string; disciplineId: string; programId: string }> = [
    // Информатика: ECO + BIZ + IST
    { id: "DP000001", disciplineId: dInformat.id, programId: prgEco.id },
    { id: "DP000002", disciplineId: dInformat.id, programId: prgBiz.id },
    { id: "DP000003", disciplineId: dInformat.id, programId: prgIst.id },
    // История экономики: ECO + BIZ
    { id: "DP000004", disciplineId: dHistEco.id, programId: prgEco.id },
    { id: "DP000005", disciplineId: dHistEco.id, programId: prgBiz.id },
    // Менеджмент: BIZ
    { id: "DP000006", disciplineId: dMgmt.id, programId: prgBiz.id },
    // Дизайн мышления: BIZ
    { id: "DP000007", disciplineId: dDesign.id, programId: prgBiz.id },
    // Базы данных: IST
    { id: "DP000008", disciplineId: dDb.id, programId: prgIst.id },
    // Английский язык: ECO + BIZ + IST
    { id: "DP000009", disciplineId: dEng.id, programId: prgEco.id },
    { id: "DP000010", disciplineId: dEng.id, programId: prgBiz.id },
    { id: "DP000011", disciplineId: dEng.id, programId: prgIst.id },
  ];
  await prisma.disciplineProgram.createMany({ data: dp, skipDuplicates: true });

  // Students (IDs + gaudiId <= 8)
  const mkStudent = (n: number, groupId: string, name: string) => ({
    id: `S${String(n).padStart(7, "0")}`.slice(0, 8),
    gaudiId: `ST${String(n).padStart(6, "0")}`.slice(0, 8),
    groupId,
    name,
    isActive: true,
    deletedAt: null as null,
  });

  let s = 1;
  const students: Array<{ id: string; gaudiId: string; groupId: string; name: string; isActive: boolean; deletedAt: null }> = [];

  const addGroupStudents = (groupId: string, names: string[]) => {
    for (const name of names) students.push(mkStudent(s++, groupId, name));
  };

  addGroupStudents("GIST525", [
    "Абрамов Дмитрий Игоревич",
    "Волков Артем Сергеевич",
    "Денисова Алина Максимовна",
    "Ермаков Кирилл Викторович",
    "Иванова Дарья Алексеевна",
    "Кузнецов Максим Андреевич",
    "Лебедева Полина Витальевна",
    "Морозов Илья Евгеньевич",
  ]);

  addGroupStudents("GIST524", [
    "Белов Антон Николаевич",
    "Гаврилова Елена Сергеевна",
    "Дмитриев Олег Петрович",
    "Козлов Даниил Михайлович",
    "Новикова Ксения Павловна",
  ]);

  addGroupStudents("GUB423", [
    "Аксенова Вероника Юрьевна",
    "Борисов Глеб Валерьевич",
    "Васильев Роман Кириллович",
    "Зайцева Анна Борисовна",
    "Королев Никита Сергеевич",
  ]);

  addGroupStudents("GE123", [
    "Беляев Егор Александрович",
    "Виноградова Ольга Николаевна",
    "Герасимов Владислав Игоревич",
    "Жукова Татьяна Васильевна",
    "Казаков Матвей Артемович",
    "Лазарева София Михайловна",
    "Макаров Андрей Петрович",
  ]);

  addGroupStudents("GE124", [
    "Орлова Кристина Эдуардовна",
    "Панкратов Денис Олегович",
    "Романова Диана Игоревна",
    "Савельев Тимофей Викторович",
    "Тихонова Валерия Сергеевна",
    "Ушаков Леонид Аркадьевич",
    "Филиппова Надежда Юрьевна",
  ]);

  addGroupStudents("GM225", [
    "Шашкова Милана Алексеевна",
    "Щербаков Марк Григорьевич",
    "Юдина Мария Дмитриевна",
    "Яковлев Александр Сергеевич",
    "Белоусов Иван Геннадьевич",
  ]);

  await prisma.student.createMany({ data: students, skipDuplicates: true });

  // Class sessions to represent "предмет + преподаватель + группа"
  const mkTime = (dayOffset: number, hour: number) => {
    const start = new Date(startOfToday.getTime() + dayOffset * dayMs);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + 90 * 60 * 1000);
    return { start, end };
  };
  let sc = 1;
  const mkSched = () => `SC${String(sc++).padStart(6, "0")}`.slice(0, 8);

  const makeSession = async (disciplineId: string, teacherId: string, groupId: string, dayOffset: number, hour: number) => {
    const { start, end } = mkTime(dayOffset, hour);
    await prisma.classSession.create({
      data: {
        id: `CS${String(sc).padStart(6, "0")}`.slice(0, 8),
        scheduleExternalId: mkSched(),
        gaudiId: null,
        disciplineId,
        groupId,
        teacherId,
        semesterId: semester.id,
        startTime: start,
        endTime: end,
        status: "scheduled",
        statusV2: "scheduled",
        openedAt: null,
        flagLateTeacher: false,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
  };

  const G = {
    IST25: "GIST525",
    IST24: "GIST524",
    UB423: "GUB423",
    E123: "GE123",
    E124: "GE124",
    M225: "GM225",
  } as const;

  // 1) Информатика — Иванов — ИСТ-5-24; УБ-4-23; Э-1-23
  await makeSession(dInformat.id, "TIVANOV", G.IST24, 1, 9);
  await makeSession(dInformat.id, "TIVANOV", G.UB423, 1, 11);
  await makeSession(dInformat.id, "TIVANOV", G.E123, 1, 13);

  // 2) История экономики — Белов — УБ-4-23; Э-1-23; Э-1-24; М-2-25
  await makeSession(dHistEco.id, "TBELMAX", G.UB423, 2, 9);
  await makeSession(dHistEco.id, "TBELMAX", G.E123, 2, 11);
  await makeSession(dHistEco.id, "TBELMAX", G.E124, 2, 13);
  await makeSession(dHistEco.id, "TBELMAX", G.M225, 2, 15);

  // 3) Менеджмент — Соколова — М-2-25
  await makeSession(dMgmt.id, "TSOKNV", G.M225, 3, 9);

  // 4) Дизайн мышления — Иванов — (направление УБ) групп не указано
  await makeSession(dDesign.id, "TIVANOV", G.UB423, 3, 11);

  // 5) Базы данных — Кузнецова — ИСТ-5-25; ИСТ-5-24
  await makeSession(dDb.id, "TKUZOL", G.IST25, 4, 9);
  await makeSession(dDb.id, "TKUZOL", G.IST24, 4, 11);

  // 6) Английский язык — Сидоров — УБ-4-23; Э-1-23; Э-1-24; ИСТ-5-25; ИСТ-5-24
  await makeSession(dEng.id, "TSIDAP", G.UB423, 5, 9);
  await makeSession(dEng.id, "TSIDAP", G.E123, 5, 11);
  await makeSession(dEng.id, "TSIDAP", G.E124, 5, 13);
  await makeSession(dEng.id, "TSIDAP", G.IST25, 5, 15);
  await makeSession(dEng.id, "TSIDAP", G.IST24, 6, 9);

  // 7) Информатика — Кузнецова — ИСТ-5-25; Э-1-24
  await makeSession(dInformat.id, "TKUZOL", G.IST25, 6, 11);
  await makeSession(dInformat.id, "TKUZOL", G.E124, 6, 13);

  // 8) Информатика — Петрова — М-2-25
  await makeSession(dInformat.id, "TPETEV", G.M225, 7, 9);

  // 9) Английский язык — Михайлов — М-2-25
  await makeSession(dEng.id, "TMIKDA", G.M225, 7, 11);
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

