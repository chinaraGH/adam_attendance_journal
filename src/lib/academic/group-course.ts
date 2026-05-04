/**
 * Извлекает числовой «год набора» из конца названия/кода группы (последний сегмент из цифр).
 * Примеры: ИСТ-5-25 → 25, УБ-4-23 → 23.
 */
export function extractCohortYearFromGroupLabel(label: string): number | null {
  const s = label.trim();
  if (!s) return null;
  const m = s.match(/(?:^|[-\s])(\d{1,2})$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * По всем группам находится максимальный год набора → это 1 курс.
 * Курс группы: maxYear - year + 1 (пример при max=25: год 23 → 3 курс).
 */
export function computeCourseNumber(params: { cohortYear: number | null; maxCohortYear: number | null }): number | null {
  const { cohortYear, maxCohortYear } = params;
  if (cohortYear === null || maxCohortYear === null) return null;
  const c = maxCohortYear - cohortYear + 1;
  return c >= 1 ? c : null;
}

export function computeMaxCohortYearFromLabels(labels: Array<string | null | undefined>): number | null {
  let max: number | null = null;
  for (const label of labels) {
    if (!label) continue;
    const y = extractCohortYearFromGroupLabel(label);
    if (y === null) continue;
    if (max === null || y > max) max = y;
  }
  return max;
}
