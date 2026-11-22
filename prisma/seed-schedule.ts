/**
 * Демо-расписание: занятия нон-стопом каждые 30 минут, несколько групп и преподавателей одновременно.
 * Период: пятница 20.11.2026 09:47 → пятница 27.11.2026 00:00, то есть включая весь день 26 ноября (по Бишкеку, UTC+6).
 *
 * Запускается из scripts/db-bootstrap.mjs, если задана переменная DEMO_SCHEDULE_VERSION.
 * Каждая версия выполняется один раз (метка в audit_trail), поэтому повторные деплои ничего не перезаписывают.
 * Чтобы выполнить заново, поменяйте значение DEMO_SCHEDULE_VERSION.
 *
 * ВНИМАНИЕ: заменяет все занятия, отметки посещаемости, оценки и технологические карты.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VERSION = process.env.DEMO_SCHEDULE_VERSION ?? "";
const SLOT_MS = 30 * 60 * 1000;
const CONCURRENT = 4; // сколько занятий идёт одновременно
const START = new Date(Date.UTC(2026, 10, 20, 3, 47, 0)); // 20.11.2026 09:47 Бишкек
const END = new Date(Date.UTC(2026, 10, 26, 18, 0, 0)); //   27.11.2026 00:00 Бишкек (весь день 26 ноября включён)

// преподаватель, дисциплина, группа (все пары «дисциплина + направление группы» существуют в disciplineProgram)
const TRIPLES: Array<[string, string, string]> = [
  ["TIVANOV", "DINF", "GIST524"], ["TIVANOV", "DINF", "GUB423"], ["TIVANOV", "DINF", "GE123"],
  ["TKUZOL", "DINF", "GIST525"], ["TKUZOL", "DINF", "GE124"], ["TPETEV", "DINF", "GM225"],
  ["TBELMAX", "DHISECO", "GUB423"], ["TBELMAX", "DHISECO", "GE123"],
  ["TMOROEK", "DHISECO", "GE124"], ["TMOROEK", "DHISECO", "GM225"],
  ["TSOKNV", "DMNG", "GM225"], ["TVOLAND", "DMNG", "GUB423"],
  ["TVASANS", "DDESIGN", "GUB423"], ["TNIKSV", "DDESIGN", "GM225"],
  ["TKUZOL", "DDB", "GIST525"], ["TDMITIG", "DDB", "GIST524"],
  ["TSIDAP", "DENG", "GUB423"], ["TSIDAP", "DENG", "GE123"], ["TSIDAP", "DENG", "GE124"],
  ["TMIKDA", "DENG", "GM225"], ["TMIKDA", "DENG", "GIST525"], ["TPAVLAS", "DENG", "GIST524"],
];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const split = (pool: number, n: number): number[] => {
  const base = Math.floor((pool / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? r2(pool - base * (n - 1)) : base));
};

async function main() {
  if (!VERSION) {
    console.log("[seed-schedule] DEMO_SCHEDULE_VERSION не задан, пропускаю.");
    return;
  }
  const done = await prisma.auditTrail.findFirst({ where: { action: "demo_schedule_seed", entityId: VERSION }, select: { id: true } });
  if (done) {
    console.log(`[seed-schedule] версия ${VERSION} уже применена, пропускаю.`);
    return;
  }

  const semester = await prisma.semester.findFirst({
    where: { isLocked: false, startDate: { lte: START }, endDate: { gte: END } },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (!semester) throw new Error("Не найден открытый семестр, покрывающий 20–26 ноября 2026.");

  const groups = await prisma.group.findMany({ select: { id: true, programId: true } });
  const programOf = new Map(groups.map((g) => [g.id, g.programId]));
  for (const [t, d, g] of TRIPLES) {
    if (!programOf.get(g)) throw new Error(`У группы ${g} нет направления (${t}/${d}).`);
  }

  // Раскладка по слотам: в слоте не больше одного занятия на преподавателя и на группу.
  // Берём тех, у кого уже меньше всего занятий (сначала по преподавателю, затем по связке), чтобы нагрузка выровнялась.
  type Slot = { start: Date; end: Date; triple: [string, string, string] };
  const slots: Slot[] = [];
  const teacherCount = new Map<string, number>();
  const tripleCount = new Map<number, number>();
  let rot = 0;
  for (let t = START.getTime(); t < END.getTime(); t += SLOT_MS) {
    const order = TRIPLES.map((tr, idx) => ({ tr, idx }))
      .sort(
        (x, y) =>
          (teacherCount.get(x.tr[0]) ?? 0) - (teacherCount.get(y.tr[0]) ?? 0) ||
          (tripleCount.get(x.idx) ?? 0) - (tripleCount.get(y.idx) ?? 0) ||
          ((x.idx - rot + TRIPLES.length) % TRIPLES.length) - ((y.idx - rot + TRIPLES.length) % TRIPLES.length),
      );
    const usedT = new Set<string>();
    const usedG = new Set<string>();
    let picked = 0;
    for (const { tr, idx } of order) {
      if (picked >= CONCURRENT) break;
      if (usedT.has(tr[0]) || usedG.has(tr[2])) continue;
      usedT.add(tr[0]);
      usedG.add(tr[2]);
      teacherCount.set(tr[0], (teacherCount.get(tr[0]) ?? 0) + 1);
      tripleCount.set(idx, (tripleCount.get(idx) ?? 0) + 1);
      slots.push({ start: new Date(t), end: new Date(Math.min(t + SLOT_MS, END.getTime())), triple: tr });
      picked++;
    }
    rot = (rot + 3) % TRIPLES.length;
  }

  console.log(`[seed-schedule] занятий: ${slots.length}. Очищаю старые занятия и карты...`);
  await prisma.controlScore.deleteMany({});
  await prisma.lessonScore.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.techCard.deleteMany({});
  await prisma.classSession.deleteMany({});

  await prisma.classSession.createMany({
    data: slots.map((s, i) => ({
      id: `DS${String(i + 1).padStart(5, "0")}`,
      source: "SCHEDULE",
      scheduleExternalId: `DEMO${String(i + 1).padStart(6, "0")}`,
      disciplineId: s.triple[1],
      groupId: s.triple[2],
      teacherId: s.triple[0],
      semesterId: semester.id,
      outOfSemester: false,
      semesterResolutionStatus: "IN_SEMESTER",
      startTime: s.start,
      endTime: s.end,
      status: "scheduled",
      statusV2: "scheduled",
      isActive: true,
    })),
  });

  // Технологические карты: по одной на преподавателя + дисциплину + направление.
  // Занятий в модуле = половина максимального числа занятий группы, так что в карте хватает строк на все занятия.
  const perGroup = new Map<string, number>();
  for (const s of slots) {
    const k = `${s.triple[0]}|${s.triple[1]}|${s.triple[2]}`;
    perGroup.set(k, (perGroup.get(k) ?? 0) + 1);
  }
  const cards = new Map<string, { t: string; d: string; p: string; max: number }>();
  for (const [t, d, g] of TRIPLES) {
    const p = programOf.get(g)!;
    const key = `${t}|${d}|${p}`;
    const c = cards.get(key) ?? { t, d, p, max: 0 };
    c.max = Math.max(c.max, perGroup.get(`${t}|${d}|${g}`) ?? 0);
    cards.set(key, c);
  }
  const cardIds = new Map<string, string>();
  for (const [key, c] of cards) {
    const lessons = Math.max(1, Math.min(60, Math.ceil(c.max / 2)));
    const current = split(20, lessons);
    const row = await prisma.techCard.create({
      data: {
        disciplineId: c.d,
        programId: c.p,
        semesterId: semester.id,
        teacherId: c.t,
        latePercent: 50,
        extraMaxPoints: 10,
        modules: {
          create: [1, 2].map((moduleNo) => ({
            moduleNo,
            lessonsCount: lessons,
            attendancePoints: 5,
            selfWorkPoints: 10,
            currentControlPoints: 20,
            borderControlPoints: 15,
            lessons: { create: current.map((points, i) => ({ lessonNo: i + 1, points })) },
          })),
        },
      },
      select: { id: true },
    });
    cardIds.set(key, row.id);
  }

  // Пример баллов за самостоятельную работу и рубежный контроль (Базы данных, ИСТ-5-25, Кузнецова)
  const demoProgram = programOf.get("GIST525")!;
  const demoCard = cardIds.get(`TKUZOL|DDB|${demoProgram}`);
  if (demoCard) {
    const st = await prisma.student.findMany({ where: { groupId: "GIST525" }, orderBy: { name: "asc" }, take: 4 });
    const self = [9, 7.5, 6, 2];
    const border = [12, 11, 9, 5];
    for (let i = 0; i < st.length; i++) {
      await prisma.controlScore.createMany({
        data: [
          { techCardId: demoCard, studentId: st[i].id, category: "SELF_WORK", moduleNo: 1, score: self[i], enteredById: "TKUZOL" },
          { techCardId: demoCard, studentId: st[i].id, category: "BORDER_CONTROL", moduleNo: 1, score: border[i], enteredById: "TKUZOL" },
        ],
      });
    }
  }

  await prisma.auditTrail.create({
    data: {
      actorType: "system",
      actorId: "seed-schedule",
      action: "demo_schedule_seed",
      entityType: "Schedule",
      entityId: VERSION,
      beforeJson: null,
      afterJson: JSON.stringify({ sessions: slots.length, cards: cards.size, from: START.toISOString(), to: END.toISOString() }),
    },
    select: { id: true },
  });
  console.log(`[seed-schedule] готово: занятий ${slots.length}, технологических карт ${cards.size}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
