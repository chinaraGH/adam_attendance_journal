import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { fmtDateTime } from "@/lib/ui/office";

function extractRoleFromAuditJson(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { role?: string; source?: string };
    if (typeof parsed?.role === "string") return parsed.role;
    return null;
  } catch {
    return null;
  }
}

export default async function AdminStudentPage(props: { params: { id: string } }) {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return (
      <main className="mx-auto max-w-[900px] p-4">
        <h1 className="text-[22px] font-extrabold">Профиль студента</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">Недостаточно прав.</p>
      </main>
    );
  }

  const id = props.params.id;

  const student = await prisma.student.findFirst({
    where: { id, isActive: true, deletedAt: null },
    select: { id: true, name: true, gaudiId: true, group: { select: { id: true, name: true, code: true } } },
  });

  if (!student) {
    return (
      <main className="mx-auto max-w-[900px] p-4">
        <h1 className="text-[22px] font-extrabold">Профиль студента</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">Не найден.</p>
      </main>
    );
  }
  const linkedUser = await prisma.appUser.findFirst({
    where: { id: student.id, isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });
  const recentRoleSync = linkedUser
    ? await prisma.auditTrail.findMany({
        where: {
          entityType: "User",
          entityId: linkedUser.id,
          action: { in: ["gaudi_role_sync", "user_access_recalculated"] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, createdAt: true, action: true, afterJson: true },
      })
    : [];
  const gaudiUserRoles = linkedUser
    ? await prisma.userRole.findMany({
        where: { userId: linkedUser.id, source: "gaudi", isActive: true, deletedAt: null },
        orderBy: { roleCode: "asc" },
        select: { id: true, roleCode: true, source: true },
      })
    : [];
  const manualUserRoles = linkedUser
    ? await prisma.userRole.findMany({
        where: { userId: linkedUser.id, source: "manual", isActive: true, deletedAt: null },
        orderBy: { roleCode: "asc" },
        select: { id: true, roleCode: true },
      })
    : [];

  return (
    <main className="mx-auto max-w-[900px] p-4">
      <h1 className="text-[22px] font-extrabold">{student.name}</h1>
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm">
        <div>
          <span className="font-black">GAUDI</span>: {student.gaudiId}
        </div>
        <div className="mt-1">
          <span className="font-black">Группа</span>:{" "}
          <Link className="font-bold underline" href={`/admin/groups/${student.group.id}`}>
            {student.group.code ?? student.group.name}
          </Link>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm">
        <div className="font-black">Роли (GAUDI и журнал)</div>
        {!linkedUser ? (
          <div className="mt-2 text-gray-600">Пользователь журнала с этим идентификатором не найден.</div>
        ) : (
          <>
            <div className="mt-2">
              <span className="font-black">Роль в журнале</span>: {linkedUser.role}
            </div>
            <div className="mt-2">
              <span className="font-black">Роли из GAUDI</span>:{" "}
              {gaudiUserRoles.length > 0 ? gaudiUserRoles.map((r) => r.roleCode).join(", ") : "—"}
            </div>
            <div className="mt-2">
              <span className="font-black">Назначена вручную</span>:{" "}
              {manualUserRoles.length > 0 ? manualUserRoles.map((r) => r.roleCode).join(", ") : "—"}
            </div>
            <div className="mt-2 text-xs text-gray-600">Последние события синхронизации ролей:</div>
            {recentRoleSync.length === 0 ? (
              <div className="mt-1 text-gray-600">Событий синхронизации ролей нет.</div>
            ) : (
              <ul className="mt-2 list-none space-y-2 p-0">
                {recentRoleSync.map((item) => (
                  <li key={item.id} className="rounded-lg border border-gray-100 px-3 py-2">
                    <div className="font-semibold">{item.action}</div>
                    <div className="text-xs text-gray-600">
                      {fmtDateTime(item.createdAt)}
                      {extractRoleFromAuditJson(item.afterJson) ? ` • role: ${extractRoleFromAuditJson(item.afterJson)}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}

