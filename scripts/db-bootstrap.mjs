// Подготовка базы при сборке на Vercel (запускается из скрипта vercel-build).
//
//   before-migrate: если база не пустая и не управляется миграциями Prisma (например, осталась от старой версии),
//                   то при ALLOW_DB_RESET=true она очищается, иначе сборка останавливается с понятным сообщением.
//   after-migrate:  если задано SEED_ON_BUILD=true и таблица users пуста, база наполняется тестовыми данными.
//
// Оба шага безопасны при повторных деплоях: после первой успешной миграции (_prisma_migrations уже есть)
// очистка не выполняется никогда, а тестовые данные добавляются только в пустую базу.
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

const mode = process.argv[2];
if (!process.env.DATABASE_URL) {
  console.error("[db-bootstrap] DATABASE_URL не задан. Добавьте его в Vercel → Settings → Environment Variables.");
  process.exit(1);
}
const prisma = new PrismaClient();

async function dbState() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT (to_regclass('public._prisma_migrations') IS NOT NULL) AS migrated,
            (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS tables`,
  );
  return rows[0];
}

try {
  if (mode === "before-migrate") {
    const s = await dbState();
    if (s.migrated || s.tables === 0) {
      console.log("[db-bootstrap] база готова к миграциям (пустая или уже под управлением Prisma).");
    } else if (process.env.ALLOW_DB_RESET === "true") {
      console.log(`[db-bootstrap] в базе ${s.tables} старых таблиц без истории миграций. ALLOW_DB_RESET=true: очищаю схему public.`);
      await prisma.$executeRawUnsafe("DROP SCHEMA public CASCADE");
      await prisma.$executeRawUnsafe("CREATE SCHEMA public");
      console.log("[db-bootstrap] схема очищена.");
    } else {
      console.error(
        `[db-bootstrap] В базе есть ${s.tables} таблиц от старой версии, а истории миграций нет, поэтому миграция не пройдёт.\n` +
          "Если данные в базе тестовые и их не жалко, добавьте переменную окружения ALLOW_DB_RESET=true и повторите деплой.\n" +
          "Или создайте новую пустую базу и укажите её в DATABASE_URL.",
      );
      process.exit(1);
    }
  } else if (mode === "after-migrate") {
    if (process.env.SEED_ON_BUILD === "true") {
      const rows = await prisma.$queryRawUnsafe("SELECT count(*)::int AS n FROM users");
      if (rows[0].n === 0) {
        console.log("[db-bootstrap] SEED_ON_BUILD=true и база пустая: наполняю тестовыми данными.");
        await prisma.$disconnect();
        execSync("npx prisma db seed", { stdio: "inherit" });
      } else {
        console.log(`[db-bootstrap] в базе уже есть пользователи (${rows[0].n}), тестовые данные не добавляю.`);
      }
    } else {
      console.log("[db-bootstrap] SEED_ON_BUILD не включён, пропускаю наполнение.");
    }
  } else {
    console.error("[db-bootstrap] Используйте: before-migrate | after-migrate");
    process.exit(1);
  }
} finally {
  await prisma.$disconnect().catch(() => {});
}
