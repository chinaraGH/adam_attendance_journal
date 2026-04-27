require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

function pad(num, len) {
  return String(num).padStart(len, "0");
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const teacherId = "TBELMAX";
    const semesterId = "SEM26SP";

    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!teacher) throw new Error(`Teacher not found: ${teacherId}`);

    const semester = await prisma.semester.findFirst({
      where: { id: semesterId },
      select: { id: true },
    });
    if (!semester) throw new Error(`Semester not found: ${semesterId}`);

    // "Сегодня" — от начала дня (локальное время; для Бишкека это корректно в вашем окружении UTC+6).
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const minutesPerSession = 80; // 1ч 20м
    const days = 10;
    const totalMinutes = days * 24 * 60;
    const sessionsCount = Math.floor(totalMinutes / minutesPerSession); // 180

    // Use existing groups & disciplines. Cycle them.
    const groupIds = ["GUB423", "GE123", "GE124", "GM225"];
    const disciplineIds = ["DHISECO", "DMNG", "DINF", "DENG"];

    const rows = [];
    for (let i = 1; i <= sessionsCount; i++) {
      const s = new Date(start.getTime() + (i - 1) * minutesPerSession * 60 * 1000);
      const e = new Date(s.getTime() + minutesPerSession * 60 * 1000);

      // IDs <= 8 symbols.
      const n = pad(i, 6);
      const id = `CB${n}`; // 8
      const scheduleExternalId = `BM${n}`; // 8, unique prefix

      rows.push({
        id,
        scheduleExternalId,
        gaudiId: null,
        disciplineId: disciplineIds[(i - 1) % disciplineIds.length],
        groupId: groupIds[(i - 1) % groupIds.length],
        teacherId,
        semesterId,
        startTime: s,
        endTime: e,
        status: "scheduled",
        statusV2: "scheduled",
        openedAt: null,
        flagLateTeacher: false,
        isActive: true,
        deletedAt: null,
      });
    }

    // Remove previous auto-generated rows for this teacher in the same window (safe rerun).
    const endWindow = new Date(start.getTime() + totalMinutes * 60 * 1000);
    const del = await prisma.classSession.deleteMany({
      where: {
        teacherId,
        startTime: { gte: start, lt: endWindow },
      },
    });

    const created = await prisma.classSession.createMany({
      data: rows,
      skipDuplicates: true,
    });

    console.log(
      `[TBELMAX schedule] teacher=${teacher.name} deleted=${del.count} created=${created.count} from=${start.toISOString()} to=${endWindow.toISOString()}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

