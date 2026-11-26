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
