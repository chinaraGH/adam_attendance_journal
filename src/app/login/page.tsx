import { prisma } from "@/lib/prisma";

import { loginWithRole } from "./actions";

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, role: true },
    orderBy: [{ role: "asc" }, { id: "asc" }],
    take: 200,
  });

  const roles = Array.from(new Set(users.map((u) => u.role))).sort();

  return (
    <main className="mx-auto max-w-[520px] p-6">
      <h1 className="text-2xl font-black">Вход (тестовый)</h1>
      <p className="mt-2 text-sm text-gray-600">Выберите роль и ID пользователя из seed.</p>

      <form action={loginWithRole} className="mt-4 grid gap-3 rounded-xl border bg-white p-4">
        <label className="grid gap-2 text-sm font-bold">
          Роль
          <select name="role" className="rounded-lg border px-3 py-2 font-bold">
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-bold">
          User ID
          <select name="userId" className="rounded-lg border px-3 py-2 font-bold">
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id} ({u.role})
              </option>
            ))}
          </select>
        </label>

        <button className="mt-2 rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-black text-white">
          Войти
        </button>
      </form>
    </main>
  );
}

