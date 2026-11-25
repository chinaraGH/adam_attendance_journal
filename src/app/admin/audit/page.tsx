import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { fmtDateTime } from "@/lib/ui/office";

export default async function AdminAuditPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN") {
    return (
      <main className="mx-auto max-w-[1200px] p-4">
        <h1 className="text-[22px] font-extrabold">Журнал действий</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">Недостаточно прав.</p>
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
    <main className="mx-auto max-w-[1200px] p-4">
      <h1 className="text-[22px] font-extrabold">Журнал действий</h1>
      <p className="mt-0.5 text-[13px] text-gray-500">Последние 50 записей.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-3 py-2 font-black">Время</th>
              <th className="px-3 py-2 font-black">Кто</th>
              <th className="px-3 py-2 font-black">Действие</th>
              <th className="px-3 py-2 font-black">Сущность</th>
              <th className="px-3 py-2 font-black">Было</th>
              <th className="px-3 py-2 font-black">Стало</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-bold">{fmtDateTime(r.createdAt)}</td>
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

