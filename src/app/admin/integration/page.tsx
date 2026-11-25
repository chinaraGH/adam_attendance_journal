import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import { fmtDateTime } from "@/lib/ui/office";

export default async function AdminIntegrationPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return (
      <main className="mx-auto max-w-[1200px] p-4">
        <h1 className="text-[22px] font-extrabold">Интеграции</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">Недостаточно прав.</p>
      </main>
    );
  }

  const logs = await prisma.integrationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, provider: true, status: true, createdAt: true, details: true },
  });

  return (
    <main className="mx-auto max-w-[1200px] p-4">
      <h1 className="text-[22px] font-extrabold">Интеграции</h1>
      <p className="mt-0.5 text-[13px] text-gray-500">Последние 20 обменов данными с внешними системами.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-3 py-2 font-black">Время</th>
              <th className="px-3 py-2 font-black">Источник</th>
              <th className="px-3 py-2 font-black">Статус</th>
              <th className="px-3 py-2 font-black">Подробности</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-bold">{fmtDateTime(l.createdAt)}</td>
                <td className="px-3 py-2 font-black">{l.provider}</td>
                <td className="px-3 py-2 font-black">{l.status}</td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {l.details ? JSON.stringify(l.details).slice(0, 500) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

