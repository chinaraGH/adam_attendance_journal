/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const dbUrl = process.env.DATABASE_URL || "";
    const host = (dbUrl.match(/@([^/]+)/) || [])[1] || "(unknown)";
    console.log("DATABASE_URL host:", host);

    const deleted = await prisma.$transaction(async (tx) => {
      const out = {};

      // Delete children first (FK constraints).
      out.attendance = (await tx.attendance.deleteMany({})).count;
      out.auditTrail = (await tx.auditTrail.deleteMany({})).count;
      out.integrationLog = (await tx.integrationLog.deleteMany({})).count;

      out.classSession = (await tx.classSession.deleteMany({})).count;
      out.student = (await tx.student.deleteMany({})).count;
      out.userGroupCurator = (await tx.userGroupCurator.deleteMany({})).count;

      out.teacher = (await tx.teacher.deleteMany({})).count;
      out.discipline = (await tx.discipline.deleteMany({})).count;
      out.group = (await tx.group.deleteMany({})).count;
      out.program = (await tx.program.deleteMany({})).count;
      out.faculty = (await tx.faculty.deleteMany({})).count;
      out.semester = (await tx.semester.deleteMany({})).count;

      return out;
    });

    console.log("Deleted counts:", deleted);
    console.log("Users left:", await prisma.appUser.count());
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

