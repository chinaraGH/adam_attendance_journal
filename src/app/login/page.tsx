import { prisma } from "@/lib/prisma";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  let users: { id: string; role: string }[] = [];
  let dbError: string | null = null;
  try {
    users = await prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, role: true },
      orderBy: [{ role: "asc" }, { id: "asc" }],
      take: 200,
    });
  } catch (e) {
    console.error("Login page: user list load failed", e);
    dbError =
      "Сейчас не удаётся подключиться к базе. Проверьте в Vercel переменную DATABASE_URL (и сеть к PostgreSQL), затем сделайте редеплой.";
  }

  return (
    <main className="mx-auto max-w-[520px] p-6">
      <h1 className="text-2xl font-black">Вход</h1>
      <p className="mt-2 text-sm text-gray-600">Для тестирования используйте логины из seed.</p>

      {dbError ? (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900"
          role="alert"
        >
          {dbError}
        </div>
      ) : null}

      <div className="mt-4">
        <LoginForm users={users} dbUnavailable={Boolean(dbError)} />
      </div>
    </main>
  );
}

