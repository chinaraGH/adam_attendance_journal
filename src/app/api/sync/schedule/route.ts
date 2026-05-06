import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { requireSyncAuth } from "@/lib/sync/auth";

type ScheduleSessionInput = {
  scheduleExternalId: string;
  groupGaudiId: string;
  disciplineCode: string;
  teacherGaudiId?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
  teacherEmail?: string | null;
  startTime: string;
  endTime: string;
  status?: string | null;
};

export async function POST(request: NextRequest) {
  if (!requireSyncAuth(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const correlationId = request.headers.get("x-correlation-id")?.trim() || randomUUID();
  let added = 0;
  let updated = 0;
  const errors: Array<{
    type: string;
    category: "validation" | "business" | "temporary";
    code: string;
    message: string;
    recommendation: string;
    scheduleExternalId?: string;
    payload?: any;
  }> = [];
  const warnings: Array<{ code: string; message: string; scheduleExternalId?: string }> = [];

  try {
    const body = (await request.json()) as { sessions?: ScheduleSessionInput[] };
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];

    for (const s of sessions) {
      if (!s?.scheduleExternalId || !s?.groupGaudiId || !s?.disciplineCode || !s?.startTime || !s?.endTime) {
        errors.push({
          type: "session",
          category: "validation",
          code: "INVALID_PAYLOAD",
          message: "Invalid session payload",
          recommendation: "Provide scheduleExternalId, groupGaudiId, disciplineCode, startTime, endTime",
          scheduleExternalId: s?.scheduleExternalId,
          payload: s,
        });
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(s, "semesterId")) {
        warnings.push({
          code: "SEMESTER_ID_IGNORED",
          message: "Incoming semesterId from Schedule is ignored; semester is resolved inside EJP",
          scheduleExternalId: s.scheduleExternalId,
        });
      }

      const group = await prisma.group.findFirst({
        where: { gaudiId: s.groupGaudiId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!group) {
        errors.push({
          type: "session",
          category: "business",
          code: "GROUP_NOT_FOUND",
          message: "Group not found",
          recommendation: "Sync groups from GAUDI before schedule sync",
          scheduleExternalId: s.scheduleExternalId,
          payload: s,
        });
        continue;
      }

      const discipline = await prisma.discipline.findFirst({
        where: { code: s.disciplineCode, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!discipline) {
        errors.push({
          type: "session",
          code: "DISCIPLINE_NOT_FOUND",
          message: "Discipline not found",
          category: "business",
          recommendation: "Sync disciplines from GAUDI before schedule sync",
          scheduleExternalId: s.scheduleExternalId,
          payload: s,
        });
        continue;
      }

      let teacherId: string | null = s.teacherId ?? null;
      if (!teacherId && s.teacherGaudiId) {
        const t = await prisma.teacher.findFirst({
          where: { gaudiId: s.teacherGaudiId, isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (t?.id) {
          teacherId = t.id;
          if (s.teacherName || s.teacherEmail) {
            await prisma.teacher.update({
              where: { id: t.id },
              data: {
                name: s.teacherName ?? undefined,
                email: s.teacherEmail ?? undefined,
                isActive: true,
                deletedAt: null,
              },
              select: { id: true },
            });
          }
        } else if (s.teacherName) {
          const created = await prisma.teacher.create({
            data: {
              id: randomUUID(),
              gaudiId: s.teacherGaudiId,
              name: s.teacherName,
              email: s.teacherEmail ?? null,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true },
          });
          teacherId = created.id;
        }
      }
      if (!teacherId) {
        errors.push({
          type: "session",
          category: "business",
          code: "TEACHER_NOT_FOUND",
          message: "Teacher not found",
          recommendation: "Provide teacherId or known teacherGaudiId/teacherName for auto-create",
          scheduleExternalId: s.scheduleExternalId,
          payload: s,
        });
        continue;
      }

      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        errors.push({
          type: "session",
          code: "INVALID_DATETIME",
          message: "Invalid start/end time",
          category: "validation",
          recommendation: "Use ISO datetime strings for startTime and endTime",
          scheduleExternalId: s.scheduleExternalId,
          payload: s,
        });
        continue;
      }
      const resolvedSemester = await prisma.semester.findFirst({
        where: {
          startDate: { lte: start },
          endDate: { gte: start },
        },
        orderBy: { startDate: "desc" },
        select: { id: true },
      });
      const nextSemesterId = resolvedSemester?.id ?? null;
      const nextOutOfSemester = !resolvedSemester;

      const existed = await prisma.classSession.findFirst({
        where: { scheduleExternalId: s.scheduleExternalId },
        select: { id: true, status: true, statusV2: true, outOfSemester: true, semesterId: true },
      });

      const incomingStatus = (s.status ?? "").trim().toLowerCase();
      const normalizedIncomingStatus = incomingStatus === "cancelled" ? "" : incomingStatus;
      const baseStatus = normalizedIncomingStatus || "scheduled";
      const isCancelledInEjp =
        (existed?.statusV2 ?? "").trim().toLowerCase() === "cancelled" || (existed?.status ?? "").trim().toLowerCase() === "cancelled";
      const nextStatus = isCancelledInEjp ? "cancelled" : baseStatus;

      await prisma.classSession.upsert({
        where: { scheduleExternalId: s.scheduleExternalId },
        create: {
          scheduleExternalId: s.scheduleExternalId,
          gaudiId: null,
          disciplineId: discipline.id,
          groupId: group.id,
          teacherId,
          semesterId: nextSemesterId,
          outOfSemester: nextOutOfSemester,
          startTime: start,
          endTime: end,
          status: nextStatus,
          statusV2: nextStatus,
          openedAt: null,
          flagLateTeacher: false,
          isActive: true,
          deletedAt: null,
        },
        update: {
          disciplineId: discipline.id,
          groupId: group.id,
          teacherId,
          semesterId: nextSemesterId,
          outOfSemester: nextOutOfSemester,
          startTime: start,
          endTime: end,
          status: nextStatus,
          statusV2: nextStatus,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (existed && (Boolean(existed.outOfSemester) !== nextOutOfSemester || existed.semesterId !== nextSemesterId)) {
        await prisma.auditTrail.create({
          data: {
            actorType: "system",
            actorId: null,
            action: "class_session_semester_resolution_update",
            entityType: "ClassSession",
            entityId: existed.id,
            beforeJson: JSON.stringify({ semesterId: existed.semesterId, outOfSemester: existed.outOfSemester }),
            afterJson: JSON.stringify({ semesterId: nextSemesterId, outOfSemester: nextOutOfSemester, correlationId, source: "schedule" }),
          },
          select: { id: true },
        });
      }

      existed ? (updated += 1) : (added += 1);
    }

    const finishedAt = new Date();
    await prisma.integrationLog.create({
      data: {
        provider: "schedule",
        status: errors.length > 0 ? "error" : "success",
        details: { correlationId, startedAt, finishedAt, added, updated, warnings: warnings.slice(0, 50), errors: errors.slice(0, 50) },
      },
      select: { id: true },
    });

    return NextResponse.json({
      ok: errors.length === 0,
      added,
      updated,
      correlationId,
      warningsCount: warnings.length,
      warnings: warnings.slice(0, 50),
      errorsCount: errors.length,
      errors: errors.slice(0, 50),
    });
  } catch (e) {
    const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : String(e);
    const temporaryError = {
      type: "sync",
      category: "temporary" as const,
      code: "SYNC_TEMPORARY_FAILURE",
      message,
      recommendation: "Retry sync request with same correlationId after temporary issue is resolved",
    };
    await prisma.integrationLog.create({
      data: {
        provider: "schedule",
        status: "error",
        details: { correlationId, startedAt, finishedAt: new Date(), added, updated, error: message, errors: errors.slice(0, 50) },
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: false, correlationId, errorsCount: 1, errors: [temporaryError] }, { status: 503 });
  }
}

