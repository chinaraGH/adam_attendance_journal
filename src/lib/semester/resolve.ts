import { prisma } from "@/lib/prisma";

export type SemesterOption = { id: string; name: string | null; isLocked: boolean };

/** Все семестры для выпадающего списка (новые сверху). Закрытые тоже доступны для просмотра. */
export async function listSemesterOptions(): Promise<SemesterOption[]> {
  return prisma.semester.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, isLocked: true },
  });
}

/**
 * Какой семестр показывать в аналитике: выбранный, иначе последний открытый, иначе последний закрытый.
 * Закрытый семестр доступен только для просмотра, поэтому в аналитике и выгрузках он есть всегда.
 */
export async function resolveSemesterId(requested?: string | null): Promise<string | null> {
  if (requested) {
    const found = await prisma.semester.findUnique({ where: { id: requested }, select: { id: true } });
    if (found) return found.id;
  }
  const open = await prisma.semester.findFirst({ where: { isLocked: false }, orderBy: { startDate: "desc" }, select: { id: true } });
  if (open) return open.id;
  const last = await prisma.semester.findFirst({ orderBy: { startDate: "desc" }, select: { id: true } });
  return last?.id ?? null;
}

export type LatestSemester = { id: string; name: string | null; startDate: Date; endDate: Date; isLocked: boolean };

/**
 * Последний семестр (по дате начала): открытый или, если новый ещё не создан, закрытый.
 * Преподаватель, куратор и студент видят аналитику только за него.
 */
export async function latestSemester(): Promise<LatestSemester | null> {
  return prisma.semester.findFirst({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true, isLocked: true },
  });
}

export async function latestSemesterId(): Promise<string | null> {
  return (await latestSemester())?.id ?? null;
}

/** Сдвигает период [from, to] внутрь семестра (даты в локальном времени сервера, как и в отчётах). */
export function clampPeriodToSemester(from: Date, to: Date, sem: { startDate: Date; endDate: Date }): { from: Date; to: Date } {
  const start = new Date(sem.startDate);
  const end = new Date(sem.endDate);
  end.setHours(23, 59, 59, 999);
  let f = from < start ? start : from;
  let t = to > end ? end : to;
  if (f > t) {
    t = t < start ? start : t;
    f = new Date(t);
    f.setDate(f.getDate() - 30);
    f.setHours(0, 0, 0, 0);
    if (f < start) f = start;
  }
  return { from: f, to: t };
}
