import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = "TEACHER_TEST";

  const user = await prisma.appUser.upsert({
    where: { id: userId },
    update: { role: "CURATOR", isActive: true, deletedAt: null },
    create: { id: userId, role: "CURATOR", isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });

  const groups = await prisma.group.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, code: true, name: true },
  });
  const groupIds = groups.map((g) => g.id);

  if (groupIds.length === 0) {
    console.log(`[fix-curator] user=${user.id} role=${user.role} groups=0 (nothing to link)`);
    return;
  }

  // Reactivate previously existing links (soft-delete aware).
  const reactivated = await prisma.userGroupCurator.updateMany({
    where: { userId, groupId: { in: groupIds } },
    data: { isActive: true, deletedAt: null },
  });

  const existing = await prisma.userGroupCurator.findMany({
    where: { userId, groupId: { in: groupIds } },
    select: { groupId: true },
  });
  const existingSet = new Set(existing.map((x) => x.groupId));
  const missingGroupIds = groupIds.filter((gid) => !existingSet.has(gid));

  const created =
    missingGroupIds.length === 0
      ? { count: 0 }
      : await prisma.userGroupCurator.createMany({
          data: missingGroupIds.map((groupId) => ({
            userId,
            groupId,
            isActive: true,
            deletedAt: null,
          })),
          // In case of a race, rely on @@unique([userId, groupId]).
          skipDuplicates: true,
        });

  console.log(
    `[fix-curator] user=${user.id} role=${user.role} groups=${groupIds.length} reactivated=${reactivated.count} created=${created.count}`
  );
}

main()
  .catch((e) => {
    console.error("[fix-curator] failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

