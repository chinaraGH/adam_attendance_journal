import { prisma } from "@/lib/prisma";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, role: true },
    orderBy: [{ role: "asc" }, { id: "asc" }],
    take: 200,
  });

  return (
    <main className="mx-auto max-w-[520px] p-6">
      <h1 className="text-2xl font-black">Вход</h1>
      <p className="mt-2 text-sm text-gray-600">Для тестирования используйте логины из seed.</p>

      <div className="mt-4">
        <LoginForm users={users} />
      </div>
    </main>
  );
}

