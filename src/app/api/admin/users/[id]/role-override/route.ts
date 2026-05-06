import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { recalculateAccessForUser } from "@/lib/auth/recalculate-access";

const allowedRoles = new Set(["ADMIN", "ACADEMIC_OFFICE", "CURATOR", "TEACHER", "STUDENT", "LEADERSHIP"]);

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  let actor: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    actor = await getCurrentUser();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const correlationId = request.headers.get("x-correlation-id")?.trim() || randomUUID();
  const userId = context.params.id;
  const body = (await request.json()) as { role?: string; reason?: string };
  const nextRole = String(body.role ?? "").trim().toUpperCase();
  const reason = String(body.reason ?? "").trim();

  if (!allowedRoles.has(nextRole)) {
    return NextResponse.json({ ok: false, error: "Invalid role", correlationId }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ ok: false, error: "Reason is required", correlationId }, { status: 400 });
  }

  const user = await prisma.appUser.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found", correlationId }, { status: 404 });
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE public.user_roles
      SET is_active = false,
          deleted_at = now(),
          updated_at = now()
      WHERE user_id = $1
        AND source = 'manual'
        AND is_active = true
    `,
    userId,
  );
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO public.user_roles (
        id,
        user_id,
        role_code,
        source,
        is_active,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, 'manual', true, NULL, now(), now()
      )
      ON CONFLICT (user_id, role_code, source)
      DO UPDATE SET
        is_active = true,
        deleted_at = NULL,
        updated_at = now()
    `,
    randomUUID(),
    userId,
    nextRole,
  );

  if (user.role !== nextRole) {
    await prisma.appUser.update({
      where: { id: userId },
      data: { role: nextRole },
      select: { id: true },
    });
  }

  await prisma.auditTrail.create({
    data: {
      actorType: actor.role.toLowerCase(),
      actorId: actor.id,
      action: "user_role_manual_override",
      entityType: "User",
      entityId: userId,
      beforeJson: JSON.stringify({ role: user.role, source: "manual", correlationId }),
      afterJson: JSON.stringify({ role: nextRole, source: "manual", reason, correlationId }),
    },
    select: { id: true },
  });

  await recalculateAccessForUser({
    userId,
    actorType: actor.role === "ADMIN" ? "admin" : "academic_office",
    actorId: actor.id,
    source: "manual",
    correlationId,
  });

  return NextResponse.json({ ok: true, correlationId, userId, role: nextRole });
}
