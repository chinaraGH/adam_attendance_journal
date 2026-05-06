import { prisma } from "@/lib/prisma";

type RecalculateAccessParams = {
  userId: string;
  actorType: "system" | "admin" | "academic_office";
  actorId: string | null;
  source: "gaudi" | "manual";
  correlationId?: string;
};

export async function recalculateAccessForUser(params: RecalculateAccessParams) {
  const user = await prisma.appUser.findFirst({
    where: { id: params.userId, isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) {
    return { ok: false as const, reason: "USER_NOT_FOUND" as const };
  }

  // Access is resolved from current DB role on every request.
  // This audit event marks the recomputation checkpoint for integrations.
  await prisma.auditTrail.create({
    data: {
      actorType: params.actorType,
      actorId: params.actorId,
      action: "user_access_recalculated",
      entityType: "User",
      entityId: user.id,
      beforeJson: null,
      afterJson: JSON.stringify({ role: user.role, source: params.source, correlationId: params.correlationId ?? null }),
    },
    select: { id: true },
  });

  return { ok: true as const };
}
