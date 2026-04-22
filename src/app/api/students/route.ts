import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId");

  if (!groupId) {
    return NextResponse.json(
      { ok: false, error: "Не указан groupId." },
      { status: 400 },
    );
  }

  try {
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        students: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            gaudiId: true,
            groupId: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, error: "Группа не найдена или недоступна." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, groupId: group.id, students: group.students });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Не удалось загрузить список студентов. Повторите попытку." },
      { status: 500 },
    );
  }
}

