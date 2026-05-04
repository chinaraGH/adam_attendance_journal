import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/prisma";

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function toStartOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toEndOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(23, 59, 59, 999);
  return next;
}

export async function GET(request: Request) {
  try {
    const actor = await getCurrentUser();
    if (actor.role !== "STUDENT") {
      return NextResponse.json({ disciplines: [] }, { status: 403 });
    }

    const student = await prisma.student.findFirst({
      where: { id: actor.id, isActive: true, deletedAt: null },
      select: { group: { select: { id: true } } },
    });
    if (!student) {
      return NextResponse.json({ disciplines: [] }, { status: 404 });
    }

    const url = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    defaultFrom.setHours(0, 0, 0, 0);
    const defaultTo = new Date(now);
    defaultTo.setHours(23, 59, 59, 999);

    const from = toStartOfDay(parseDateParam(url.searchParams.get("from")) ?? defaultFrom);
    const to = toEndOfDay(parseDateParam(url.searchParams.get("to")) ?? defaultTo);

    const sessions = await prisma.classSession.findMany({
      where: {
        groupId: student.group.id,
        isActive: true,
        deletedAt: null,
        startTime: { gte: from, lte: to },
        NOT: [{ statusV2: "cancelled" }, { status: "cancelled" }],
      },
      select: { discipline: { select: { id: true, name: true } } },
    });

    const disciplines = Array.from(new Map(sessions.map((s) => [s.discipline.id, s.discipline] as const)).values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({ value: d.id, label: d.name }));

    return NextResponse.json({ disciplines });
  } catch {
    return NextResponse.json({ disciplines: [] }, { status: 401 });
  }
}

