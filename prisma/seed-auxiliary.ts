import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [logN, auditN] = await Promise.all([prisma.integrationLog.count(), prisma.auditTrail.count()]);

  if (logN === 0) {
    await prisma.integrationLog.createMany({
      data: [
        {
          provider: "gaudi",
          status: "success",
          details: { message: "Демо-запись: интеграция ещё не запускалась", seeded: true },
        },
        {
          provider: "schedule",
          status: "success",
          details: { message: "Демо-запись: расписание не синхронизировалось", seeded: true },
        },
      ],
    });
  }

  if (auditN === 0) {
    await prisma.auditTrail.createMany({
      data: [
        {
          actorType: "system",
          actorId: null,
          action: "seed_auxiliary",
          entityType: "System",
          entityId: "seed",
          beforeJson: null,
          afterJson: JSON.stringify({ message: "Демо-запись аудита при первичном наполнении" }),
        },
      ],
    });
  }

  console.log(
    `[seed-auxiliary] integration_logs: was ${logN} -> now ${await prisma.integrationLog.count()}; audit_trail: was ${auditN} -> now ${await prisma.auditTrail.count()}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
