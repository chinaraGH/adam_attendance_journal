/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const r = await prisma.$queryRawUnsafe(
      "SELECT to_regclass('public.departments') as departments, to_regclass('public.programs') as programs",
    );
    console.log("tables:", r);

    const c = await prisma.$queryRawUnsafe(
      "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('groups','disciplines') AND column_name IN ('department_id','program_id') ORDER BY table_name,column_name",
    );
    console.log("columns:", c);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

