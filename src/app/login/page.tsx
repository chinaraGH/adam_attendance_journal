import { prisma } from "@/lib/prisma";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

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
    <main style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em" }}>Вход</h1>
      <p style={{ marginTop: 8, fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
        Для тестирования используйте логины из seed.
      </p>

      {dbError ? (
        <div
          style={{
            marginTop: 16,
            borderRadius: 12,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            padding: "10px 12px",
            fontSize: 13,
            fontWeight: 800,
            color: "#92400e",
          }}
          role="alert"
        >
          {dbError}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <LoginForm users={users} dbUnavailable={Boolean(dbError)} />
      </div>
    </main>
  );
}

