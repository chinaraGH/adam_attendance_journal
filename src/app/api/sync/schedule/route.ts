import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSyncAuth } from "@/lib/sync/auth";

type ScheduleSessionInput = {
  scheduleExternalId: string;
  groupGaudiId: string;
  disciplineCode: string;
  teacherGaudiId?: string | null;
  teacherId?: string | null;
  semesterId: string;
  startTime: string;
  endTime: string;
  status?: string | null;
};

export async function POST(request: NextRequest) {
  if (!requireSyncAuth(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  let added = 0;
  let updated = 0;
  const errors: Array<{ type: string; message: string; payload?: any }> = [];

  try {
    const body = (await request.json()) as { sessions?: ScheduleSessionInput[] };
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];

    for (const s of sessions) {
      if (!s?.scheduleExternalId || !s?.groupGaudiId || !s?.disciplineCode || !s?.semesterId || !s?.startTime || !s?.endTime) {
        errors.push({ type: "session", message: "Invalid session payload", payload: s });
        continue;
      }

      const group = await prisma.group.findFirst({
        where: { gaudiId: s.groupGaudiId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!group) {
        errors.push({ type: "session", message: "Group not found", payload: s });
        continue;
      }

      const discipline = await prisma.discipline.findFirst({
        where: { code: s.disciplineCode, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!discipline) {
        errors.push({ type: "session", message: "Discipline not found", payload: s });
        continue;
      }

      let teacherId: string | null = s.teacherId ?? null;
      if (!teacherId && s.teacherGaudiId) {
        const t = await prisma.teacher.findFirst({
          where: { gaudiId: s.teacherGaudiId, isActive: true, deletedAt: null },
          select: { id: true },
        });
        teacherId = t?.id ?? null;
      }
      if (!teacherId) {
        errors.push({ type: "session", message: "Teacher not found", payload: s });
        continue;
      }

      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        errors.push({ type: "session", message: "Invalid start/end time", payload: s });
        continue;
      }

      const existed = await prisma.classSession.findFirst({
        where: { scheduleExternalId: s.scheduleExternalId },
        select: { id: true },
      });

      await prisma.classSession.upsert({
        where: { scheduleExternalId: s.scheduleExternalId },
        create: {
          scheduleExternalId: s.scheduleExternalId,
          gaudiId: null,
          disciplineId: discipline.id,
          groupId: group.id,
          teacherId,
          semesterId: s.semesterId,
          startTime: start,
          endTime: end,
          status: s.status ?? "scheduled",
          statusV2: s.status ?? "scheduled",
          openedAt: null,
          flagLateTeacher: false,
          isActive: true,
          deletedAt: null,
        },
        update: {
          disciplineId: discipline.id,
          groupId: group.id,
          teacherId,
          semesterId: s.semesterId,
          startTime: start,
          endTime: end,
          status: s.status ?? "scheduled",
          statusV2: s.status ?? "scheduled",
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });

      existed ? (updated += 1) : (added += 1);
    }

    const finishedAt = new Date();
    await prisma.integrationLog.create({
      data: {
        provider: "schedule",
        status: errors.length > 0 ? "error" : "success",
        addedCount: added,
        updatedCount: updated,
        errorCount: errors.length,
        detailsJson: JSON.stringify({ startedAt, finishedAt, errors: errors.slice(0, 50) }),
      },
      select: { id: true },
    });

    return NextResponse.json({
      ok: errors.length === 0,
      added,
      updated,
      errorsCount: errors.length,
      errors: errors.slice(0, 50),
    });
  } catch (e) {
    const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : String(e);
    await prisma.integrationLog.create({
      data: {
        provider: "schedule",
        status: "error",
        addedCount: added,
        updatedCount: updated,
        errorCount: errors.length + 1,
        detailsJson: JSON.stringify({ startedAt, finishedAt: new Date(), error: message, errors: errors.slice(0, 50) }),
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

