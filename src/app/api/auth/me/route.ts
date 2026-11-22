import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { formatRoleLabel } from "@/lib/ui/labels";

export async function GET() {
  let actor: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    actor = await getCurrentUser();
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const user = await prisma.appUser.findFirst({
    where: { id: actor.id, isActive: true, deletedAt: null },
    select: { id: true, role: true, isActive: true, createdAt: true, updatedAt: true },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: "Пользователь не найден." }, { status: 404 });
  }

  const teacher =
    actor.role === "TEACHER"
      ? await prisma.teacher.findFirst({
          where: { id: actor.id, isActive: true, deletedAt: null },
          select: { id: true, name: true, gaudiId: true },
        })
      : null;

  const student =
    actor.role === "STUDENT"
      ? await prisma.student.findFirst({ where: { id: actor.id, isActive: true, deletedAt: null }, select: { name: true } })
      : null;
  // Имена хранятся только у преподавателей и студентов; у остальных ролей показываем логин.
  const displayName = teacher?.name ?? student?.name ?? user.id;

  return NextResponse.json({ ok: true, user, teacher, displayName, role: user.role, roleLabel: formatRoleLabel(user.role) });
}

