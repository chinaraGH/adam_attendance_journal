import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

export default async function AdminAuditPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN") {
    return (
      <main className="mx-auto max-w-[1100px] p-6">
        <h1 className="text-2xl font-black">Audit Trail</h1>
        <p className="mt-3 text-sm text-gray-600">Недостаточно прав.</p>
      </main>
    );
  }

  const rows = await prisma.auditTrail.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      actorType: true,
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      beforeJson: true,
      afterJson: true,
    },
  });

  return (
    <main className="mx-auto max-w-[1100px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-black">Audit Trail (последние 50)</h1>
        <Link className="font-bold underline" href="/admin/search">
          ← Поиск
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-3 py-2 font-black">Время</th>
              <th className="px-3 py-2 font-black">Кто</th>
              <th className="px-3 py-2 font-black">Действие</th>
              <th className="px-3 py-2 font-black">Сущность</th>
              <th className="px-3 py-2 font-black">Before</th>
              <th className="px-3 py-2 font-black">After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-bold">{new Date(r.createdAt).toLocaleString("ru-RU")}</td>
                <td className="px-3 py-2">
                  <span className="font-black">{r.actorType}</span> <span className="text-gray-600">{r.actorId ?? "—"}</span>
                </td>
                <td className="px-3 py-2 font-bold">{r.action}</td>
                <td className="px-3 py-2">
                  <span className="font-black">{r.entityType}</span> <span className="text-gray-600">{r.entityId}</span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">{r.beforeJson ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{r.afterJson ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

