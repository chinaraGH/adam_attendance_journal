import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export async function GET(_request: Request, ctx: { params: { id: string } }) {
  const actor = await getCurrentUser();
  if (actor.role !== "TEACHER") {
    return NextResponse.json({ ok: false, error: "Недостаточно прав." }, { status: 403 });
  }

  const classId = ctx?.params?.id;
  if (!classId) {
    return NextResponse.json({ ok: false, error: "Не указан id занятия." }, { status: 400 });
  }

  const session = await prisma.classSession.findFirst({
    where: { id: classId, teacherId: actor.id, isActive: true, deletedAt: null },
    select: {
      id: true,
      groupId: true,
      disciplineId: true,
      teacherId: true,
      semesterId: true,
      startTime: true,
      endTime: true,
      openedAt: true,
      status: true,
      statusV2: true,
      group: { select: { id: true, name: true, code: true } },
      discipline: { select: { id: true, name: true, code: true } },
      semester: { select: { id: true, isLocked: true, startDate: true, endDate: true } },
    },
  });

  if (!session) {
    return NextResponse.json({ ok: false, error: "Занятие не найдено или недоступно." }, { status: 404 });
  }

  const students = await prisma.student.findMany({
    where: { groupId: session.groupId, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, gaudiId: true },
  });

  const attendances = await prisma.attendance.findMany({
    where: { classSessionId: session.id, isActive: true, deletedAt: null },
    select: { id: true, studentId: true, status: true, statusV2: true, updatedBy: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, session, students, attendances });
}

