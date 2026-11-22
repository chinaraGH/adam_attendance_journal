/** Чистые функции расчёта баллов (без базы данных). */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Показ баллов: 0,5 · 2 · 7,25 */
export function formatPoints(n: number): string {
  return String(round2(n)).replace(".", ",");
}

/** Разбор введённого числа: "7,5" → 7.5, "" → null, мусор → NaN. */
export function parsePoints(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const t = String(input).trim().replace(",", ".");
  if (t === "") return null;
  // Допускаем «4,5», «4.5», «.4» и «4.»: на многих телефонах в цифровой клавиатуре только точка.
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return Number.NaN;
  return Number(t);
}

/**
 * Какая доля баллов за посещение занятия достаётся студенту.
 * П, А и подтверждённая Б — полностью, О — по проценту из карты, остальное (НБ, неподтверждённая Б, S) — ничего.
 */
export function attendanceCredit(statusV2: string | null | undefined, latePercent: number): number {
  switch ((statusV2 ?? "").toUpperCase()) {
    case "P":
    case "A":
    case "B_CONFIRMED":
      return 1;
    case "O":
      return Math.min(100, Math.max(0, latePercent)) / 100;
    default:
      return 0;
  }
}

/** Баллы за посещение одного занятия. */
export function attendancePointsForLesson(
  statusV2: string | null | undefined,
  attendancePerLesson: number,
  latePercent: number,
): number {
  return round2(attendancePerLesson * attendanceCredit(statusV2, latePercent));
}

export type ModuleDraft = {
  lessonsCount: number;
  attendancePoints: number;
  selfWorkPoints: number;
  currentControlPoints: number;
  borderControlPoints: number;
  lessons: number[];
};

export type CardLimits = { modulePoints: number; totalPoints: number; extraMaxPoints: number };

const EPS = 1e-9;

/** Проверка технологической карты. Возвращает первую ошибку или null. */
export function validateTechCard(
  input: { latePercent: number; extraMaxPoints: number; modules: ModuleDraft[] },
  limits: CardLimits,
): string | null {
  const nums = [input.latePercent, input.extraMaxPoints];
  for (const m of input.modules) nums.push(m.lessonsCount, m.attendancePoints, m.selfWorkPoints, m.currentControlPoints, m.borderControlPoints, ...m.lessons);
  if (nums.some((x) => typeof x !== "number" || !Number.isFinite(x) || x < 0)) {
    return "Все баллы должны быть неотрицательными числами.";
  }
  if (input.latePercent > 100) return "Процент баллов за опоздание: от 0 до 100.";
  if (input.extraMaxPoints > limits.extraMaxPoints + EPS) {
    return `Дополнительные баллы: не больше ${formatPoints(limits.extraMaxPoints)}.`;
  }
  if (input.modules.length !== 2) return "В карте должно быть два модуля.";

  let total = 0;
  for (let i = 0; i < input.modules.length; i++) {
    const m = input.modules[i];
    const label = `Модуль ${i + 1}`;
    if (!Number.isInteger(m.lessonsCount) || m.lessonsCount > 60) return `${label}: число занятий — целое от 0 до 60.`;
    if (m.lessons.length !== m.lessonsCount) return `${label}: баллы заданы не для всех занятий.`;
    if (m.selfWorkPoints <= 0) return `${label}: задайте баллы за самостоятельную работу.`;
    if (m.currentControlPoints <= 0) return `${label}: задайте баллы за текущий контроль.`;
    if (m.borderControlPoints <= 0) return `${label}: задайте баллы за рубежный контроль.`;
    if (m.attendancePoints > 0 && m.lessonsCount === 0) return `${label}: для баллов за посещение нужны занятия.`;

    const sum = m.attendancePoints + m.selfWorkPoints + m.currentControlPoints + m.borderControlPoints;
    if (sum > limits.modulePoints + EPS) {
      return `${label}: сумма баллов ${formatPoints(sum)} больше лимита модуля ${formatPoints(limits.modulePoints)}.`;
    }
    const lessonsSum = m.lessons.reduce((a, b) => a + b, 0);
    if (lessonsSum > m.currentControlPoints + EPS) {
      return `${label}: баллы по занятиям (${formatPoints(lessonsSum)}) больше текущего контроля (${formatPoints(m.currentControlPoints)}).`;
    }
    total += sum;
  }
  if (total > limits.totalPoints + EPS) {
    return `Сумма двух модулей ${formatPoints(total)} больше лимита семестра ${formatPoints(limits.totalPoints)}.`;
  }
  return null;
}

/** Итог студента: модули считаются отдельно (каждый не больше лимита), плюс дополнительные, всё не больше лимита семестра. */
export function studentTotal(params: {
  moduleTotals: number[];
  extra: number;
  limits: CardLimits;
}): number {
  const modules = params.moduleTotals.reduce((a, v) => a + Math.min(v, params.limits.modulePoints), 0);
  return round2(Math.min(params.limits.totalPoints, modules + params.extra));
}
