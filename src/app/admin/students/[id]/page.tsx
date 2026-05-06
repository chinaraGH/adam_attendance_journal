import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

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
      <main className="mx-auto max-w-[900px] p-6">
        <h1 className="text-2xl font-black">Профиль студента</h1>
        <p className="mt-3 text-sm text-gray-600">Недостаточно прав.</p>
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
      <main className="mx-auto max-w-[900px] p-6">
        <h1 className="text-2xl font-black">Профиль студента</h1>
        <p className="mt-3 text-sm text-gray-600">Не найден.</p>
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

  return (
    <main className="mx-auto max-w-[900px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-black">{student.name}</h1>
        <Link className="font-bold underline" href="/acadepartment">
          ← Поиск
        </Link>
      </div>
      <div className="mt-3 rounded-xl border bg-white p-4 text-sm">
        <div>
          <span className="font-black">ID</span>: {student.id}
        </div>
        <div className="mt-1">
          <span className="font-black">GAUDI</span>: {student.gaudiId}
        </div>
        <div className="mt-1">
          <span className="font-black">Группа</span>:{" "}
          <Link className="font-bold underline" href={`/admin/groups/${student.group.id}`}>
            {student.group.code ?? student.group.name}
          </Link>
        </div>
      </div>
      <div className="mt-3 rounded-xl border bg-white p-4 text-sm">
        <div className="font-black">Роли (GAUDI / ЭЖП)</div>
        {!linkedUser ? (
          <div className="mt-2 text-gray-600">Пользователь ЭЖП с этим ID не найден.</div>
        ) : (
          <>
            <div className="mt-2">
              <span className="font-black">Effective роль ЭЖП</span>: {linkedUser.role}
            </div>
            <div className="mt-2 text-xs text-gray-600">Последние события синка ролей:</div>
            {recentRoleSync.length === 0 ? (
              <div className="mt-1 text-gray-600">Нет событий GAUDI role sync.</div>
            ) : (
              <ul className="mt-2 list-none space-y-2 p-0">
                {recentRoleSync.map((item) => (
                  <li key={item.id} className="rounded-lg border border-gray-100 px-3 py-2">
                    <div className="font-semibold">{item.action}</div>
                    <div className="text-xs text-gray-600">
                      {new Date(item.createdAt).toLocaleString("ru-RU")}
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

