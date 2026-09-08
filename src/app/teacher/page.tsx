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
    <main className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="text-gray-500 font-bold">Сегодня (Bishkek): {nowBishkek.toLocaleDateString("ru-RU")}</div>
        <Link
          href="/teacher/reports"
          className="border border-gray-900 rounded-xl px-4 py-2.5 font-black text-gray-900 bg-white hover:bg-gray-50 transition-colors text-center w-full sm:w-auto"
        >
          Просмотр отчетов
        </Link>
      </div>

      {sessionCards.length === 0 ? (
        <p className="text-gray-500 text-center py-12">На сегодня занятий нет.</p>
      ) : (
        <div className="grid gap-4">
          {sessionCards.map(({ session, effective, totalStudents, markedCount, isFilled }) => {
            const href = `/attendance/${session.id}`;
            const timeRange = formatTimeRange(session.startTime, session.endTime);

            const isActive = effective === "active";
            const isReadOnly = effective === "finished" || effective === "auto_closed" || effective === "cancelled";

            const hasSavedAttendance = markedCount > 0;
            const statusLabel = isActive ? (hasSavedAttendance ? "Заполнено" : "Требуется заполнение") : isFilled ? "Заполнено" : null;

            const CardInner = (
              <div className={`border border-gray-200 rounded-2xl p-4 sm:p-5 bg-white transition-all shadow-sm hover:shadow-md ${isActive ? 'opacity-100 ring-2 ring-blue-500/20' : 'opacity-90'}`}>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-4 sm:gap-6">
                  <div className="flex-1">
                    <div className="font-black text-lg text-gray-900 leading-tight">
                      {formatDisciplineLabel({ disciplineId: session.disciplineId, disciplineName: session.discipline?.name })}
                    </div>
                    <div className="mt-1.5 text-gray-700 font-bold">{session.group.name}</div>
                    <div className="mt-2 flex items-center text-gray-500 font-medium">
                      <svg className="w-4 h-4 mr-1.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {timeRange}
                    </div>
                  </div>

                  <div className="sm:text-right flex flex-row sm:flex-col justify-between items-center sm:items-end border-t sm:border-0 pt-3 sm:pt-0 mt-1 sm:mt-0 border-gray-100">
                    <div className="font-black text-gray-900 bg-gray-100 sm:bg-transparent px-2.5 py-1 sm:p-0 rounded-md sm:rounded-none text-sm sm:text-base">
                      {formatClassSessionStatusLabel(effective)}
                    </div>
                    <div className="text-right">
                      {statusLabel ? (
                        <div className={`mt-0 sm:mt-2 text-sm sm:text-base font-extrabold ${hasSavedAttendance || isFilled ? "text-green-600" : "text-amber-600"}`}>
                          {statusLabel}
                        </div>
                      ) : null}
                      <div className="mt-0.5 sm:mt-1 text-gray-500 font-medium text-sm sm:text-base">
                        {markedCount}/{totalStudents}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`mt-4 pt-3 border-t border-gray-100 font-bold flex items-center justify-center sm:justify-start ${isActive ? 'text-blue-600' : isReadOnly ? 'text-gray-700' : 'text-gray-400'}`}>
                  {isActive ? (
                    <>
                      <span>Открыть журнал</span>
                      <svg className="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </>
                  ) : isReadOnly ? (
                    "Просмотр"
                  ) : (
                    "Недоступно"
                  )}
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

