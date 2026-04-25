import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSyncAuth } from "@/lib/sync/auth";

type GaudiGroupInput = { gaudiId: string; name: string; code?: string | null; isActive?: boolean };
type GaudiStudentInput = { gaudiId: string; name: string; groupGaudiId: string; isActive?: boolean };

export async function POST(request: NextRequest) {
  if (!requireSyncAuth(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  let added = 0;
  let updated = 0;
  const errors: Array<{ type: string; message: string; payload?: any }> = [];

  try {
    const body = (await request.json()) as { groups?: GaudiGroupInput[]; students?: GaudiStudentInput[] };
    const groups = Array.isArray(body.groups) ? body.groups : [];
    const students = Array.isArray(body.students) ? body.students : [];

    // 1) Upsert groups
    for (const g of groups) {
      if (!g?.gaudiId || !g?.name) {
        errors.push({ type: "group", message: "Invalid group payload", payload: g });
        continue;
      }
      const existed = await prisma.group.findFirst({ where: { gaudiId: g.gaudiId }, select: { id: true } });
      await prisma.group.upsert({
        where: { gaudiId: g.gaudiId },
        create: {
          gaudiId: g.gaudiId,
          name: g.name,
          code: g.code ?? null,
          isActive: g.isActive ?? true,
          deletedAt: null,
        },
        update: {
          name: g.name,
          code: g.code ?? null,
          isActive: g.isActive ?? true,
          deletedAt: null,
        },
        select: { id: true },
      });
      existed ? (updated += 1) : (added += 1);
    }

    // 2) Upsert students (by gaudiId). Link to group via groupGaudiId.
    for (const s of students) {
      if (!s?.gaudiId || !s?.name || !s?.groupGaudiId) {
        errors.push({ type: "student", message: "Invalid student payload", payload: s });
        continue;
      }
      const group = await prisma.group.findFirst({
        where: { gaudiId: s.groupGaudiId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!group) {
        errors.push({ type: "student", message: "Group not found for student", payload: s });
        continue;
      }

      const existed = await prisma.student.findFirst({ where: { gaudiId: s.gaudiId }, select: { id: true } });
      await prisma.student.upsert({
        where: { gaudiId: s.gaudiId },
        create: {
          gaudiId: s.gaudiId,
          name: s.name,
          groupId: group.id,
          isActive: s.isActive ?? true,
          deletedAt: null,
        },
        update: {
          name: s.name,
          groupId: group.id,
          isActive: s.isActive ?? true,
          deletedAt: null,
        },
        select: { id: true },
      });
      existed ? (updated += 1) : (added += 1);
    }

    const finishedAt = new Date();
    await prisma.integrationLog.create({
      data: {
        provider: "gaudi",
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
        provider: "gaudi",
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

