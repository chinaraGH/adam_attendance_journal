import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";

export default async function AdminIntegrationPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "ADMIN" && actor.role !== "ACADEMIC_OFFICE") {
    return (
      <main className="mx-auto max-w-[1100px] p-6">
        <h1 className="text-2xl font-black">Интеграции</h1>
        <p className="mt-3 text-sm text-gray-600">Недостаточно прав.</p>
      </main>
    );
  }

  const logs = await prisma.integrationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, provider: true, status: true, createdAt: true, details: true },
  });

  return (
    <main className="mx-auto max-w-[1100px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-black">Мониторинг интеграций</h1>
        <Link className="font-bold underline" href="/admin/search">
          ← Поиск
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-3 py-2 font-black">Время</th>
              <th className="px-3 py-2 font-black">Provider</th>
              <th className="px-3 py-2 font-black">Status</th>
              <th className="px-3 py-2 font-black">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-bold">{new Date(l.createdAt).toLocaleString("ru-RU")}</td>
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

