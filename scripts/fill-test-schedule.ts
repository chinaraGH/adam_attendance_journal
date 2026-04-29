/**
 * Генерация стресс-расписания для преподавателя TIVANOV.
 *
 * Запуск локально через терминал:
 *   npx ts-node scripts/fill-test-schedule.ts
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

const TEACHER_ID = "TIVANOV";
const DAYS = 10;
const SESSION_MINUTES = 80;
const BISHKEK_TZ = "Asia/Bishkek";
const EXTERNAL_PREFIX = "STRESS_TIVANOV";

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function toDayKeyBishkek(date: Date) {
  const z = toZonedTime(date, BISHKEK_TZ);
  const y = z.getFullYear();
  const m = String(z.getMonth() + 1).padStart(2, "0");
  const d = String(z.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

async function resolveSemesterId(periodStart: Date, periodEnd: Date) {
  const active =
    (await prisma.semester.findFirst({
      where: {
        isLocked: false,
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      orderBy: { startDate: "desc" },
      select: { id: true },
    })) ??
    (await prisma.semester.findFirst({
      where: { startDate: { lte: periodEnd }, endDate: { gte: periodStart } },
      orderBy: { startDate: "desc" },
      select: { id: true },
    })) ??
    (await prisma.semester.findFirst({
      orderBy: { startDate: "desc" },
      select: { id: true },
    }));

  if (!active) throw new Error("Не найден семестр. Сначала создайте семестр/выполните seed.");
  return active.id;
}

async function main() {
  const teacher = await prisma.teacher.findFirst({
    where: { id: TEACHER_ID, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!teacher) throw new Error(`Преподаватель не найден: ${TEACHER_ID}`);

  const sourcePairs = await prisma.classSession.findMany({
    where: { teacherId: TEACHER_ID, isActive: true, deletedAt: null },
    orderBy: [{ disciplineId: "asc" }, { groupId: "asc" }],
    select: { disciplineId: true, groupId: true },
    distinct: ["disciplineId", "groupId"],
  });

  if (sourcePairs.length === 0) {
    throw new Error(`Для преподавателя ${TEACHER_ID} не найдено закрепленных связок "предмет+группа".`);
  }

  const now = new Date();
  const nowBishkek = toZonedTime(now, BISHKEK_TZ);
  nowBishkek.setHours(0, 0, 0, 0);

  const periodStart = fromZonedTime(nowBishkek, BISHKEK_TZ);
  const totalMinutes = DAYS * 24 * 60;
  const sessionsCount = Math.floor(totalMinutes / SESSION_MINUTES); // 180
  const periodEnd = addMinutes(periodStart, sessionsCount * SESSION_MINUTES);
  const semesterId = await resolveSemesterId(periodStart, periodEnd);
  const dayKey = toDayKeyBishkek(periodStart);

  const rows: Array<{
    scheduleExternalId: string;
    gaudiId: null;
    disciplineId: string;
    groupId: string;
    teacherId: string;
    semesterId: string;
    startTime: Date;
    endTime: Date;
    status: string;
    statusV2: string;
    openedAt: null;
    flagLateTeacher: boolean;
    isActive: boolean;
    deletedAt: null;
  }> = [];

  for (let i = 0; i < sessionsCount; i += 1) {
    const pair = sourcePairs[i % sourcePairs.length]!;
    const startTime = addMinutes(periodStart, i * SESSION_MINUTES);
    const endTime = addMinutes(startTime, SESSION_MINUTES);
    const seq = String(i + 1).padStart(4, "0");

    rows.push({
      scheduleExternalId: `${EXTERNAL_PREFIX}_${dayKey}_${seq}`,
      gaudiId: null,
      disciplineId: pair.disciplineId,
      groupId: pair.groupId,
      teacherId: TEACHER_ID,
      semesterId,
      startTime,
      endTime,
      status: "scheduled",
      statusV2: "scheduled",
      openedAt: null,
      flagLateTeacher: false,
      isActive: true,
      deletedAt: null,
    });
  }

  // Идемпотентный перезапуск: удаляем только ранее сгенерированные этим скриптом записи.
  await prisma.classSession.deleteMany({
    where: {
      teacherId: TEACHER_ID,
      scheduleExternalId: { startsWith: `${EXTERNAL_PREFIX}_${dayKey}_` },
    },
  });

  const result = await prisma.classSession.createMany({
    data: rows,
    skipDuplicates: true,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        teacherId: TEACHER_ID,
        teacherName: teacher.name,
        semesterId,
        pairsUsed: sourcePairs.length,
        sessionsPlanned: sessionsCount,
        inserted: result.count,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
