import { prisma } from "@/lib/prisma";

type Actor = { id: string; role: string };

/** Какие направления видит пользователь: null — все, иначе список. */
export async function visibleProgramIds(actor: Actor): Promise<string[] | null> {
  if (actor.role === "ADMIN" || actor.role === "ACADEMIC_OFFICE") return null;
  if (actor.role === "PROGRAM_HEAD") {
    const rows = await prisma.userProgramHead.findMany({
      where: { userId: actor.id, isActive: true, deletedAt: null },
      select: { programId: true },
    });
    return rows.map((r) => r.programId);
  }
  return [];
}

export async function canViewTechCard(actor: Actor, card: { teacherId: string; programId: string }): Promise<boolean> {
  if (actor.role === "TEACHER") return card.teacherId === actor.id;
  const programs = await visibleProgramIds(actor);
  return programs === null || programs.includes(card.programId);
}
