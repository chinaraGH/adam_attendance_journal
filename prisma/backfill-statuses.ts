import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function mapLegacyAttendanceStatusToV2(status: string): string | null {
  const s = status.trim().toUpperCase();

  // Legacy UI/constants in this repo
  if (s === "PRESENT") return "P";
  if (s === "LATE") return "O";
  if (s === "UNEXCUSED_ABSENCE") return "NB";

  // If someone already stored v2 values in `status`
  if (s === "P") return "P";
  if (s === "O") return "O";
  if (s === "NB") return "NB";
  if (s === "S") return "S";
  if (s === "A") return "A";
  if (s === "B_PENDING") return "B_PENDING";
  if (s === "B_CONFIRMED") return "B_CONFIRMED";

  // Cyrillic shortcuts (if they appear)
  if (s === "П") return "P";
  if (s === "О") return "O";
  if (s === "НБ") return "NB";

  return null;
}

function mapLegacyClassSessionStatusToV2(status: string): string | null {
  const s = status.trim().toLowerCase();

  if (s === "scheduled") return "scheduled";
  if (s === "active") return "active";
  if (s === "finished") return "finished";
  if (s === "auto-closed") return "auto_closed";
  if (s === "auto_closed") return "auto_closed";
  if (s === "cancelled") return "cancelled";

  return null;
}

async function main() {
  const attendances = await prisma.attendance.findMany({
    where: { statusV2: null, status: { not: null } },
    select: { id: true, status: true },
  });

  let attendanceUpdated = 0;
  let attendanceSkipped = 0;

  for (const a of attendances) {
    const next = a.status ? mapLegacyAttendanceStatusToV2(a.status) : null;
    if (!next) {
      attendanceSkipped += 1;
      continue;
    }
    await prisma.attendance.update({
      where: { id: a.id },
      data: { statusV2: next },
    });
    attendanceUpdated += 1;
  }

  const sessions = await prisma.classSession.findMany({
    where: { statusV2: null },
    select: { id: true, status: true },
  });

  let sessionUpdated = 0;
  let sessionSkipped = 0;

  for (const s of sessions) {
    const next = mapLegacyClassSessionStatusToV2(s.status);
    if (!next) {
      sessionSkipped += 1;
      continue;
    }
    await prisma.classSession.update({
      where: { id: s.id },
      data: { statusV2: next },
    });
    sessionUpdated += 1;
  }

  console.log(
    JSON.stringify(
      {
        attendanceUpdated,
        attendanceSkipped,
        sessionUpdated,
        sessionSkipped,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

