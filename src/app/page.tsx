import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { BISHKEK_TIME_ZONE, getBishkekNow } from "@/lib/time/bishkek-now";
import { getEffectiveClassSessionStatus } from "@/lib/class-session/effective-status";
import { toZonedTime } from "date-fns-tz";
import { formatClassSessionStatusLabel, formatDisciplineLabel } from "@/lib/ui/labels";
import { getBishkekDayRangeInstants } from "@/lib/time/bishkek-day-range";

function formatTimeRange(start: Date, end: Date) {
  const s = toZonedTime(start, BISHKEK_TIME_ZONE);
  const e = toZonedTime(end, BISHKEK_TIME_ZONE);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(s.getHours())}:${pad(s.getMinutes())}–${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { nowBishkek, startInstant, endInstant } = getBishkekDayRangeInstants();

  const sessions = await prisma.classSession.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      startTime: { gte: startInstant, lte: endInstant },
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      disciplineId: true,
      startTime: true,
      endTime: true,
      openedAt: true,
      status: true,
      statusV2: true,
      group: {
        select: {
          id: true,
          name: true,
          _count: { select: { students: true } },
        },
      },
      discipline: {
        select: {
          name: true,
        },
      },
    },
  });

  const sessionCards = await Promise.all(
    sessions.map(async (s) => {
      const effective = getEffectiveClassSessionStatus({
        startTime: s.startTime,
        endTime: s.endTime,
        openedAt: s.openedAt,
        status: s.status,
        statusV2: s.statusV2,
        now: nowBishkek,
      });

      const totalStudents = s.group._count.students;
      const markedCount = await prisma.attendance.count({
        where: {
          classSessionId: s.id,
          isActive: true,
          deletedAt: null,
          statusV2: { not: null },
        },
      });
      const isFilled = totalStudents > 0 && markedCount >= totalStudents;

      return { session: s, effective, totalStudents, markedCount, isFilled };
    }),
  );

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ color: "#6b7280", fontWeight: 700 }}>Сегодня (Bishkek): {nowBishkek.toLocaleDateString("ru-RU")}</div>
        <Link
          href="/reports"
          style={{
            border: "1px solid #111827",
            borderRadius: 12,
            padding: "10px 12px",
            fontWeight: 900,
            textDecoration: "none",
            color: "#111827",
            background: "white",
          }}
        >
          Просмотр отчетов
        </Link>
      </div>

      {sessionCards.length === 0 ? (
        <p>На сегодня занятий нет.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sessionCards.map(({ session, effective, totalStudents, markedCount, isFilled }) => {
            const href = `/attendance/${session.id}`;
            const timeRange = formatTimeRange(session.startTime, session.endTime);

            const isActive = effective === "active";
            const isReadOnly = effective === "finished" || effective === "auto_closed" || effective === "cancelled";

            const statusLabel = isFilled ? "Журнал заполнен" : isActive ? "Требуется заполнение" : null;

            const CardInner = (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 14,
                  background: "white",
                  opacity: isActive ? 1 : 0.92,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>
                      {formatDisciplineLabel({ disciplineId: session.disciplineId, disciplineName: session.discipline?.name })}
                    </div>
                    <div style={{ marginTop: 4, color: "#374151", fontWeight: 700 }}>{session.group.name}</div>
                    <div style={{ marginTop: 4, color: "#6b7280" }}>{timeRange}</div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900 }}>{formatClassSessionStatusLabel(effective)}</div>
                    {statusLabel ? (
                      <div style={{ marginTop: 6, color: isFilled ? "#16a34a" : "#b45309", fontWeight: 800 }}>{statusLabel}</div>
                    ) : null}
                    <div style={{ marginTop: 4, color: "#6b7280" }}>
                      {markedCount}/{totalStudents}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, color: "#111827", fontWeight: 700 }}>
                  {isActive ? "Открыть журнал" : isReadOnly ? "Просмотр" : "Недоступно"}
                </div>
              </div>
            );

            if (effective === "scheduled") {
              return <div key={session.id}>{CardInner}</div>;
            }

            return (
              <Link key={session.id} href={href} style={{ textDecoration: "none", color: "inherit" }}>
                {CardInner}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

