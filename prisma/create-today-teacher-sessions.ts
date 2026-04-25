import { PrismaClient } from "@prisma/client";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

const BISHKEK_TZ = "Asia/Bishkek";

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60_000);
}

function addHours(d: Date, hours: number) {
  return new Date(d.getTime() + hours * 60 * 60_000);
}

async function main() {
  const teacherId = "TEACHER_TEST";

  const nowInstant = new Date();
  const nowBishkek = toZonedTime(nowInstant, BISHKEK_TZ);

  const semester =
    (await prisma.semester.findFirst({
      where: { isLocked: false },
      orderBy: { startDate: "desc" },
      select: { id: true },
    })) ??
    (await prisma.semester.findFirst({
      orderBy: { startDate: "desc" },
      select: { id: true },
    }));
  if (!semester) throw new Error("No semester found. Run seed first.");

  const group = await prisma.group.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true },
  });
  if (!group) throw new Error("No group found. Run seed first.");

  const discipline = await prisma.discipline.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true },
  });
  if (!discipline) throw new Error("No discipline found. Run seed first.");

  // Build schedule ids unique per day to avoid collisions across reruns.
  const y = nowBishkek.getFullYear();
  const m = String(nowBishkek.getMonth() + 1).padStart(2, "0");
  const d = String(nowBishkek.getDate()).padStart(2, "0");
  const dayKey = `${y}${m}${d}`;

  const toInstant = (bishkekWallClock: Date) => fromZonedTime(bishkekWallClock, BISHKEK_TZ);

  // Create 3 disciplines specifically for the 3 test sessions.
  const [discFinished, discActive, discFuture] = await prisma.$transaction([
    prisma.discipline.upsert({
      where: { code: `TEST_FINISHED_${dayKey}` },
      update: { name: `Тест-дисциплина (завершено) ${dayKey}`, isActive: true, deletedAt: null },
      create: { code: `TEST_FINISHED_${dayKey}`, name: `Тест-дисциплина (завершено) ${dayKey}`, programId: null, isActive: true, deletedAt: null },
      select: { id: true, code: true },
    }),
    prisma.discipline.upsert({
      where: { code: `TEST_ACTIVE_${dayKey}` },
      update: { name: `Тест-дисциплина (текущее) ${dayKey}`, isActive: true, deletedAt: null },
      create: { code: `TEST_ACTIVE_${dayKey}`, name: `Тест-дисциплина (текущее) ${dayKey}`, programId: null, isActive: true, deletedAt: null },
      select: { id: true, code: true },
    }),
    prisma.discipline.upsert({
      where: { code: `TEST_FUTURE_${dayKey}` },
      update: { name: `Тест-дисциплина (будущее) ${dayKey}`, isActive: true, deletedAt: null },
      create: { code: `TEST_FUTURE_${dayKey}`, name: `Тест-дисциплина (будущее) ${dayKey}`, programId: null, isActive: true, deletedAt: null },
      select: { id: true, code: true },
    }),
  ]);

  const startOfTodayBishkek = new Date(nowBishkek);
  startOfTodayBishkek.setHours(0, 0, 0, 0);

  // 1) Finished session (today, not clickable)
  const finishedStart = toInstant(addMinutes(startOfTodayBishkek, 5));
  const finishedEnd = toInstant(addMinutes(startOfTodayBishkek, 35));

  // 2) Active session: started 13 minutes ago, lasts 2 hours (clickable)
  const activeStartBishkek = addMinutes(nowBishkek, -13);
  const activeStart = toInstant(activeStartBishkek);
  const activeEnd = toInstant(addHours(activeStartBishkek, 2));

  // 3) Future session: starts at 04:00 today (not clickable)
  const futureStartBishkek = new Date(startOfTodayBishkek);
  futureStartBishkek.setHours(4, 0, 0, 0);
  const futureEndBishkek = addMinutes(futureStartBishkek, 90);
  const scheduledStart = toInstant(futureStartBishkek);
  const scheduledEnd = toInstant(futureEndBishkek);

  await prisma.classSession.upsert({
    where: { scheduleExternalId: `SCHEDULE_TODAY_${dayKey}_FINISHED_${teacherId}` },
    update: {
      disciplineId: discFinished.id,
      groupId: group.id,
      teacherId,
      semesterId: semester.id,
      startTime: finishedStart,
      endTime: finishedEnd,
      openedAt: addMinutes(finishedStart, 5),
      status: "scheduled",
      statusV2: "scheduled",
      isActive: true,
      deletedAt: null,
    },
    create: {
      scheduleExternalId: `SCHEDULE_TODAY_${dayKey}_FINISHED_${teacherId}`,
      gaudiId: null,
      disciplineId: discFinished.id,
      groupId: group.id,
      teacherId,
      semesterId: semester.id,
      startTime: finishedStart,
      endTime: finishedEnd,
      openedAt: addMinutes(finishedStart, 5),
      status: "scheduled",
      statusV2: "scheduled",
      flagLateTeacher: false,
      isActive: true,
      deletedAt: null,
    },
  });

  await prisma.classSession.upsert({
    where: { scheduleExternalId: `SCHEDULE_TODAY_${dayKey}_ACTIVE_${teacherId}` },
    update: {
      disciplineId: discActive.id,
      groupId: group.id,
      teacherId,
      semesterId: semester.id,
      startTime: activeStart,
      endTime: activeEnd,
      openedAt: addMinutes(activeStart, 1),
      status: "scheduled",
      statusV2: "scheduled",
      isActive: true,
      deletedAt: null,
    },
    create: {
      scheduleExternalId: `SCHEDULE_TODAY_${dayKey}_ACTIVE_${teacherId}`,
      gaudiId: null,
      disciplineId: discActive.id,
      groupId: group.id,
      teacherId,
      semesterId: semester.id,
      startTime: activeStart,
      endTime: activeEnd,
      openedAt: addMinutes(activeStart, 1),
      status: "scheduled",
      statusV2: "scheduled",
      flagLateTeacher: false,
      isActive: true,
      deletedAt: null,
    },
  });

  await prisma.classSession.upsert({
    where: { scheduleExternalId: `SCHEDULE_TODAY_${dayKey}_SCHEDULED_${teacherId}` },
    update: {
      disciplineId: discFuture.id,
      groupId: group.id,
      teacherId,
      semesterId: semester.id,
      startTime: scheduledStart,
      endTime: scheduledEnd,
      openedAt: null,
      status: "scheduled",
      statusV2: "scheduled",
      isActive: true,
      deletedAt: null,
    },
    create: {
      scheduleExternalId: `SCHEDULE_TODAY_${dayKey}_SCHEDULED_${teacherId}`,
      gaudiId: null,
      disciplineId: discFuture.id,
      groupId: group.id,
      teacherId,
      semesterId: semester.id,
      startTime: scheduledStart,
      endTime: scheduledEnd,
      openedAt: null,
      status: "scheduled",
      statusV2: "scheduled",
      flagLateTeacher: false,
      isActive: true,
      deletedAt: null,
    },
  });

  console.log("✅ Created/updated 3 teacher sessions for today:", {
    teacherId,
    dayKey,
    groupId: group.id,
    semesterId: semester.id,
    disciplines: [discFinished.code, discActive.code, discFuture.code],
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

