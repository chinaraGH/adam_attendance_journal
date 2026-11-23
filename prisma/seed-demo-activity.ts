/**
 * Демо-активность за ПРОШЕДШИЕ занятия: разные отметки посещаемости, оценки за занятия и контрольные баллы.
 * Заполняет только то, чего ещё нет: уже поставленные отметки и оценки не трогает.
 *
 * Запускается из scripts/db-bootstrap.mjs, если задана переменная DEMO_ACTIVITY_VERSION.
 * Каждая версия выполняется один раз (метка в audit_trail). Чтобы дозаполнить новые прошедшие занятия, смените значение.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VERSION = process.env.DEMO_ACTIVITY_VERSION ?? "";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** Детерминированное «случайное» число от 0 до 1 по строке. */
const rnd = (key: string) => (hash(key) % 100000) / 100000;

/** Профиль студента: от отличника до часто пропускающего. */
function profile(studentId: string): { attend: number; quality: number } {
  const k = hash("profile:" + studentId) % 10;
  if (k <= 2) return { attend: 0.94, quality: 0.92 };
  if (k <= 5) return { attend: 0.84, quality: 0.78 };
  if (k <= 7) return { attend: 0.7, quality: 0.62 };
  if (k === 8) return { attend: 0.52, quality: 0.5 };
  return { attend: 0.34, quality: 0.38 };
}

async function main() {
  if (!VERSION) {
    console.log("[seed-activity] DEMO_ACTIVITY_VERSION не задан, пропускаю.");
    return;
  }
  const done = await prisma.auditTrail.findFirst({ where: { action: "demo_activity_seed", entityId: VERSION }, select: { id: true } });
  if (done) {
    console.log(`[seed-activity] версия ${VERSION} уже применена, пропускаю.`);
    return;
  }

  const now = new Date();
  const ended = await prisma.classSession.findMany({
    where: { endTime: { lt: now }, isActive: true, deletedAt: null, semesterId: { not: null } },
    orderBy: { startTime: "asc" },
    select: { id: true, groupId: true, disciplineId: true, teacherId: true, semesterId: true, status: true, statusV2: true },
  });
  const notCancelled = (s: { status: string; statusV2: string | null }) => (s.statusV2 ?? s.status ?? "").trim().toLowerCase() !== "cancelled";

  const students = await prisma.student.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, groupId: true } });
  const byGroup = new Map<string, string[]>();
  for (const s of students) byGroup.set(s.groupId, [...(byGroup.get(s.groupId) ?? []), s.id]);

  // ---------- посещаемость ----------
  const existing = await prisma.attendance.findMany({
    where: { classSessionId: { in: ended.map((s) => s.id) } },
    select: { classSessionId: true, studentId: true, status: true, statusV2: true },
  });
  const have = new Set(existing.map((e) => `${e.classSessionId}|${e.studentId}`));
  const statusOf = new Map<string, string>(existing.map((e) => [`${e.classSessionId}|${e.studentId}`, (e.statusV2 ?? e.status ?? "").toUpperCase()]));

  const attData: Array<{ classSessionId: string; studentId: string; semesterId: string; status: string; statusV2: string; updatedBy: string }> = [];
  for (const ses of ended) {
    if (!notCancelled(ses)) continue;
    for (const st of byGroup.get(ses.groupId) ?? []) {
      const key = `${ses.id}|${st}`;
      if (have.has(key)) continue;
      const p = profile(st).attend;
      const u = rnd("att:" + key);
      let v2: string;
      if (u < p) v2 = rnd("o:" + key) < 0.12 ? "O" : "P";
      else {
        const w = rnd("abs:" + key);
        v2 = w < 0.5 ? "NB" : w < 0.68 ? "B_PENDING" : w < 0.86 ? "B_CONFIRMED" : "A";
      }
      attData.push({ classSessionId: ses.id, studentId: st, semesterId: ses.semesterId!, status: v2, statusV2: v2, updatedBy: "demo" });
      statusOf.set(key, v2);
    }
  }
  for (let i = 0; i < attData.length; i += 500) await prisma.attendance.createMany({ data: attData.slice(i, i + 500) });
  console.log(`[seed-activity] отметок посещаемости добавлено: ${attData.length}`);

  // ---------- оценки за занятия и контрольные баллы ----------
  const cards = await prisma.techCard.findMany({
    where: { isActive: true, deletedAt: null },
    include: { modules: { include: { lessons: { orderBy: { lessonNo: "asc" } } }, orderBy: { moduleNo: "asc" } }, semester: true },
  });

  let lessonScores = 0;
  let controlScores = 0;
  for (const card of cards) {
    const m1 = card.modules.find((m) => m.moduleNo === 1);
    const m2 = card.modules.find((m) => m.moduleNo === 2);
    if (!m1) continue;
    const c1 = m1.lessonsCount;
    const c2 = m2?.lessonsCount ?? 0;

    // группы, которым этот преподаватель ведёт дисциплину по карте
    const groupRows = await prisma.classSession.findMany({
      where: { disciplineId: card.disciplineId, teacherId: card.teacherId, semesterId: card.semesterId, isActive: true, deletedAt: null, group: { programId: card.programId } },
      distinct: ["groupId"],
      select: { groupId: true },
    });

    for (const { groupId } of groupRows) {
      const all = await prisma.classSession.findMany({
        where: { groupId, disciplineId: card.disciplineId, teacherId: card.teacherId, semesterId: card.semesterId, isActive: true, deletedAt: null },
        orderBy: { startTime: "asc" },
        select: { id: true, endTime: true, status: true, statusV2: true },
      });
      const counted = all.filter(notCancelled);

      const scoreRows: Array<{ classSessionId: string; studentId: string; score: number; enteredById: string }> = [];
      const toCheck: string[] = [];
      counted.forEach((ses, idx) => {
        if (ses.endTime >= now) return;
        const ordinal = idx + 1;
        const mod = ordinal <= c1 ? m1 : m2 && ordinal <= c1 + c2 ? m2 : null;
        if (!mod) return;
        const slot = ordinal <= c1 ? ordinal : ordinal - c1;
        const max = mod.lessons.find((l) => l.lessonNo === slot)?.points ?? 0;
        if (max <= 0) return;
        toCheck.push(ses.id);
        for (const st of byGroup.get(groupId) ?? []) {
          const status = statusOf.get(`${ses.id}|${st}`);
          if (status !== "P" && status !== "O") continue; // оценки только присутствовавшим
          const q = profile(st).quality;
          const u = rnd("ls:" + ses.id + st);
          const score = r2(Math.min(max, max * Math.max(0, q * (0.55 + 0.45 * u) + (u > 0.9 ? 0.1 : 0))));
          scoreRows.push({ classSessionId: ses.id, studentId: st, score, enteredById: card.teacherId });
        }
      });
      if (scoreRows.length > 0) {
        const exist = await prisma.lessonScore.findMany({ where: { classSessionId: { in: toCheck } }, select: { classSessionId: true, studentId: true } });
        const haveScore = new Set(exist.map((e) => `${e.classSessionId}|${e.studentId}`));
        const fresh = scoreRows.filter((r) => !haveScore.has(`${r.classSessionId}|${r.studentId}`));
        for (let i = 0; i < fresh.length; i += 500) await prisma.lessonScore.createMany({ data: fresh.slice(i, i + 500) });
        lessonScores += fresh.length;
      }

      // самостоятельная работа и рубежный контроль модуля 1, если в модуле уже прошла примерно треть занятий
      const endedInM1 = counted.slice(0, c1).filter((s) => s.endTime < now).length;
      if (c1 > 0 && endedInM1 / c1 >= 0.3) {
        const ids = byGroup.get(groupId) ?? [];
        const exist = await prisma.controlScore.findMany({ where: { techCardId: card.id, studentId: { in: ids }, moduleNo: { in: [0, 1] } }, select: { studentId: true, category: true, moduleNo: true } });
        const haveCtl = new Set(exist.map((e) => `${e.studentId}|${e.category}|${e.moduleNo}`));
        const ctl: Array<{ techCardId: string; studentId: string; category: "SELF_WORK" | "BORDER_CONTROL" | "EXTRA"; moduleNo: number; score: number; enteredById: string }> = [];
        const extraCap = Math.min(card.extraMaxPoints, card.semester.extraMaxPoints);
        for (const st of ids) {
          const q = profile(st).quality;
          if (!haveCtl.has(`${st}|SELF_WORK|1`)) {
            ctl.push({ techCardId: card.id, studentId: st, category: "SELF_WORK", moduleNo: 1, score: r2(m1.selfWorkPoints * Math.min(1, q * (0.6 + 0.4 * rnd("sw" + st + card.id)))), enteredById: card.teacherId });
          }
          if (!haveCtl.has(`${st}|BORDER_CONTROL|1`)) {
            ctl.push({ techCardId: card.id, studentId: st, category: "BORDER_CONTROL", moduleNo: 1, score: r2(m1.borderControlPoints * Math.min(1, q * (0.55 + 0.45 * rnd("bc" + st + card.id)))), enteredById: card.teacherId });
          }
          if (extraCap > 0 && q > 0.85 && rnd("ex" + st + card.id) > 0.5 && !haveCtl.has(`${st}|EXTRA|0`)) {
            ctl.push({ techCardId: card.id, studentId: st, category: "EXTRA", moduleNo: 0, score: r2(Math.min(extraCap, 1 + rnd("exs" + st + card.id) * (extraCap - 1))), enteredById: card.teacherId });
          }
        }
        if (ctl.length > 0) {
          await prisma.controlScore.createMany({ data: ctl });
          controlScores += ctl.length;
        }
      }
    }
  }

  await prisma.auditTrail.create({
    data: {
      actorType: "system",
      actorId: "seed-demo-activity",
      action: "demo_activity_seed",
      entityType: "Schedule",
      entityId: VERSION,
      beforeJson: null,
      afterJson: JSON.stringify({ attendances: attData.length, lessonScores, controlScores, until: now.toISOString() }),
    },
    select: { id: true },
  });
  console.log(`[seed-activity] готово: оценок за занятия ${lessonScores}, контрольных баллов ${controlScores}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
