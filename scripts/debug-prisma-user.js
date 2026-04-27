require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const ping = await prisma.$queryRawUnsafe("SELECT 1 as one");
    console.log("DB ping ok:", ping);

    const dbInfo = await prisma.$queryRawUnsafe(
      "SELECT current_database() as db, current_schema() as schema, version() as version;",
    );
    console.log("DB info:", dbInfo);

    const reg = await prisma.$queryRawUnsafe(`
      SELECT
        to_regclass('public.users')::text as users,
        to_regclass('public.user_group_curators')::text as user_group_curators,
        to_regclass('public.faculties')::text as faculties,
        to_regclass('public.attendances')::text as attendances;
    `);
    console.log("to_regclass:", reg);

    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name;
    `);
    console.log("public tables:", tables.map((t) => t.table_name));

    const userCols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.log("users columns:", userCols);

    const users = await prisma.appUser.findMany({ orderBy: { createdAt: "asc" } });
    console.log("User.findMany ok, count:", users.length);
    console.log("First user:", users[0] ?? null);
    console.log("Last user:", users[users.length - 1] ?? null);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exitCode = 1;
});

