"use server";

import { isAfter } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { setAdministrativeAbsence } from "@/app/actions/curator-actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import {
  decideAttendanceStatusChange,
  getCanonicalAttendanceStatusV2,
} from "@/lib/attendance/status-machine";
import { BISHKEK_TIME_ZONE, getBishkekNow } from "@/lib/time/bishkek-now";

/**
 * Только экран «Освобождения»: переключение А ↔ снятие А / первичная запись А.
 * Те же ограничения по времени и семестру, что и setAdministrativeAbsence; снятие А — локально для этого UI.
 */
export async function toggleExemptionsAdministrativeAbsence(input: { classSessionId: string; studentId: string }) {
  try {
    const actor = await getCurrentUserOrRedirect();
    if (actor.role !== "CURATOR") {
      return { ok: false as const, error: "Недостаточно прав." };
    }
    if (!input?.classSessionId || !input?.studentId) {
      return { ok: false as const, error: "Нет данных." };
    }

    const session = await prisma.classSession.findFirst({
      where: { id: input.classSessionId, isActive: true, deletedAt: null },
      select: {
        id: true,
        endTime: true,
        groupId: true,
        semesterId: true,
        semester: { select: { isLocked: true } },
      },
    });
    if (!session) return { ok: false as const, error: "Занятие не найдено." };

    const hasAccess = await prisma.userGroupCurator.findFirst({
      where: { userId: actor.id, groupId: session.groupId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!hasAccess) return { ok: false as const, error: "Нет доступа к группе." };

    if (session.semester?.isLocked) {
      return { ok: false as const, error: "Семестр закрыт. Изменение посещаемости запрещено." };
    }

    const now = getBishkekNow();
    const endBishkek = toZonedTime(session.endTime, BISHKEK_TIME_ZONE);
    if (!isAfter(now, endBishkek)) {
      return { ok: false as const, error: "Статус А можно выставлять только после окончания занятия." };
    }

    const inGroup = await prisma.student.findFirst({
      where: { id: input.studentId, groupId: session.groupId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!inGroup) return { ok: false as const, error: "Студент не в группе." };

    const row = await prisma.attendance.findFirst({
      where: {
        classSessionId: input.classSessionId,
        studentId: input.studentId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, status: true, statusV2: true },
    });

    const before = row ? getCanonicalAttendanceStatusV2(row) : null;

    if (before === "B_CONFIRMED") {
      return { ok: false as const, error: "B_CONFIRMED изменить невозможно." };
    }

    if (row && before === "A") {
      const updated = await prisma.attendance.update({
        where: { id: row.id },
        data: { status: null, statusV2: null, updatedBy: actor.id },
        select: { id: true, statusV2: true },
      });
      await prisma.auditTrail.create({
        data: {
          actorType: "curator",
          actorId: actor.id,
          action: "clear_administrative_absence",
          entityType: "Attendance",
          entityId: updated.id,
          beforeJson: JSON.stringify({ statusV2: "A" }),
          afterJson: JSON.stringify({ statusV2: null }),
        },
        select: { id: true },
      });
      return { ok: true as const, attendance: updated };
    }

    if (!row) {
      const decision = decideAttendanceStatusChange({
        actorRole: actor.role,
        isSemesterLocked: Boolean(session.semester?.isLocked),
        currentStatus: null,
        requestedStatus: "A",
      });
      if (!decision.ok) return { ok: false as const, error: decision.error };

      const created = await prisma.attendance.create({
        data: {
          classSessionId: session.id,
          studentId: input.studentId,
          semesterId: session.semesterId,
          status: decision.next,
          statusV2: decision.next,
          updatedBy: actor.id,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, statusV2: true },
      });
      await prisma.auditTrail.create({
        data: {
          actorType: "curator",
          actorId: actor.id,
          action: "set_administrative_absence",
          entityType: "Attendance",
          entityId: created.id,
          beforeJson: JSON.stringify({ statusV2: null }),
          afterJson: JSON.stringify({ statusV2: "A" }),
        },
        select: { id: true },
      });
      return { ok: true as const, attendance: created };
    }

    return await setAdministrativeAbsence({ attendanceId: row.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false as const, error: msg };
  }
}
