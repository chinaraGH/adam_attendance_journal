import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { requireSyncAuth } from "@/lib/sync/auth";
import { recalculateAccessForUser } from "@/lib/auth/recalculate-access";

type GaudiGroupInput = { gaudiId: string; name: string; code?: string | null; isActive?: boolean };
type GaudiStudentInput = { gaudiId: string; name: string; groupGaudiId: string; isActive?: boolean };
type GaudiTeacherInput = { gaudiId: string; name: string; email?: string | null; isActive?: boolean };
type GaudiUserRoleInput = { userId: string; roles?: string[] | null };

const defaultRoleMappings: Array<{ gaudiRole: string; ejpRole: string; priority: number }> = [
  { gaudiRole: "ADMIN", ejpRole: "ADMIN", priority: 10 },
  { gaudiRole: "ACADEMIC_OFFICE", ejpRole: "ACADEMIC_OFFICE", priority: 20 },
  { gaudiRole: "CURATOR", ejpRole: "CURATOR", priority: 30 },
  { gaudiRole: "TEACHER", ejpRole: "TEACHER", priority: 40 },
  { gaudiRole: "STUDENT", ejpRole: "STUDENT", priority: 50 },
];

function resolveEjpRoleFromGaudiRoles(
  roles: string[] | null | undefined,
  roleMappings: Map<string, { ejpRole: string; priority: number }>,
): string | null {
  if (!Array.isArray(roles) || roles.length === 0) return null;
  const ranked = roles
    .map((role) => role?.trim().toUpperCase())
    .filter((role): role is string => Boolean(role))
    .map((role) => ({ role, mapped: roleMappings.get(role) }))
    .filter((entry): entry is { role: string; mapped: { ejpRole: string; priority: number } } => Boolean(entry.mapped))
    .sort((a, b) => a.mapped.priority - b.mapped.priority);

  return ranked[0]?.mapped.ejpRole ?? null;
}

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
    userId?: string;
    gaudiId?: string;
    payload?: any;
  }> = [];

  try {
    const body = (await request.json()) as {
      groups?: GaudiGroupInput[];
      students?: GaudiStudentInput[];
      teachers?: GaudiTeacherInput[];
      users?: GaudiUserRoleInput[];
    };
    const groups = Array.isArray(body.groups) ? body.groups : [];
    const students = Array.isArray(body.students) ? body.students : [];
    const teachers = Array.isArray(body.teachers) ? body.teachers : [];
    const users = Array.isArray(body.users) ? body.users : [];
    const dbRoleMappings = await prisma.gaudiRoleMapping.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { priority: "asc" },
      select: { gaudiRole: true, ejpRole: true, priority: true },
    });
    const effectiveRoleMappings = dbRoleMappings.length > 0 ? dbRoleMappings : defaultRoleMappings;
    const roleMappings = new Map(
      effectiveRoleMappings.map((mapping) => [
        mapping.gaudiRole.trim().toUpperCase(),
        { ejpRole: mapping.ejpRole, priority: mapping.priority },
      ]),
    );

    // 1) Upsert groups
    for (const g of groups) {
      if (!g?.gaudiId || !g?.name) {
        errors.push({
          type: "group",
          category: "validation",
          code: "INVALID_GROUP_PAYLOAD",
          message: "Invalid group payload",
          recommendation: "Provide gaudiId and name",
          gaudiId: g?.gaudiId,
          payload: g,
        });
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
        errors.push({
          type: "student",
          category: "validation",
          code: "INVALID_STUDENT_PAYLOAD",
          message: "Invalid student payload",
          recommendation: "Provide gaudiId, name and groupGaudiId",
          gaudiId: s?.gaudiId,
          payload: s,
        });
        continue;
      }
      const group = await prisma.group.findFirst({
        where: { gaudiId: s.groupGaudiId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!group) {
        errors.push({
          type: "student",
          category: "business",
          code: "STUDENT_GROUP_NOT_FOUND",
          message: "Group not found for student",
          recommendation: "Sync groups before students",
          gaudiId: s.gaudiId,
          payload: s,
        });
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

    // 3) Upsert teachers (by gaudiId)
    for (const t of teachers) {
      if (!t?.gaudiId || !t?.name) {
        errors.push({
          type: "teacher",
          category: "validation",
          code: "INVALID_TEACHER_PAYLOAD",
          message: "Invalid teacher payload",
          recommendation: "Provide gaudiId and name",
          gaudiId: t?.gaudiId,
          payload: t,
        });
        continue;
      }

      const existed = await prisma.teacher.findFirst({ where: { gaudiId: t.gaudiId }, select: { id: true } });
      await prisma.teacher.upsert({
        where: { gaudiId: t.gaudiId },
        create: {
          id: randomUUID(),
          gaudiId: t.gaudiId,
          name: t.name,
          email: t.email ?? null,
          isActive: t.isActive ?? true,
          deletedAt: null,
        },
        update: {
          name: t.name,
          email: t.email ?? null,
          isActive: t.isActive ?? true,
          deletedAt: null,
        },
        select: { id: true },
      });
      existed ? (updated += 1) : (added += 1);
    }

    // 4) Sync user roles from GAUDI (best effort by userId -> AppUser.id)
    for (const u of users) {
      if (!u?.userId) {
        errors.push({
          type: "user-role",
          category: "validation",
          code: "INVALID_USER_ROLE_PAYLOAD",
          message: "Invalid user role payload",
          recommendation: "Provide userId and roles[]",
          userId: u?.userId,
          payload: u,
        });
        continue;
      }

      const nextRole = resolveEjpRoleFromGaudiRoles(u.roles, roleMappings);
      if (!nextRole) {
        errors.push({
          type: "user-role",
          category: "business",
          code: "NO_ROLE_MAPPING",
          message: "No supported active GAUDI role mapping found",
          recommendation: "Create active role mapping in gaudi_role_mappings",
          userId: u.userId,
          payload: u,
        });
        continue;
      }

      const existingUser = await prisma.appUser.findFirst({
        where: { id: u.userId },
        select: { id: true, role: true },
      });
      if (!existingUser) {
        errors.push({
          type: "user-role",
          category: "business",
          code: "USER_NOT_FOUND",
          message: "User not found",
          recommendation: "Create user in EJP before applying role sync",
          userId: u.userId,
          payload: u,
        });
        continue;
      }

      if (existingUser.role !== nextRole) {
        await prisma.appUser.update({
          where: { id: u.userId },
          data: { role: nextRole, isActive: true, deletedAt: null },
          select: { id: true },
        });
        await prisma.auditTrail.create({
          data: {
            actorType: "system",
            actorId: null,
            action: "gaudi_role_sync",
            entityType: "User",
            entityId: u.userId,
            beforeJson: JSON.stringify({ role: existingUser.role, source: "gaudi", correlationId }),
            afterJson: JSON.stringify({ role: nextRole, source: "gaudi", correlationId }),
          },
          select: { id: true },
        });
        await recalculateAccessForUser({
          userId: u.userId,
          actorType: "system",
          actorId: null,
          source: "gaudi",
          correlationId,
        });
        updated += 1;
      }
    }

    const finishedAt = new Date();
    await prisma.integrationLog.create({
      data: {
        provider: "gaudi",
        status: errors.length > 0 ? "error" : "success",
        details: { correlationId, startedAt, finishedAt, added, updated, errors: errors.slice(0, 50) },
      },
      select: { id: true },
    });

    return NextResponse.json({
      ok: errors.length === 0,
      added,
      updated,
      correlationId,
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
        provider: "gaudi",
        status: "error",
        details: { correlationId, startedAt, finishedAt: new Date(), added, updated, error: message, errors: errors.slice(0, 50) },
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: false, correlationId, errorsCount: 1, errors: [temporaryError] }, { status: 503 });
  }
}

