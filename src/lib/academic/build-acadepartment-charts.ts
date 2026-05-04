import { eachWeekOfInterval, format, min as dfMin, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";

import { prisma } from "@/lib/prisma";

import {
  computeCourseNumber,
  computeMaxCohortYearFromLabels,
  extractCohortYearFromGroupLabel,
} from "@/lib/academic/group-course";

export type AcadepartmentChartSeries = {
  id: string;
  label: string;
  points: (number | null)[];
};

async function resolveSemester() {
  return (
    (await prisma.semester.findFirst({
      where: { isLocked: false },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    })) ??
    (await prisma.semester.findFirst({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    }))
  );
}

function isPresent(status: string | null): boolean {
  if (!status) return false;
  const u = status.toUpperCase();
  return u === "P" || u === "O";
}

type Agg = { numer: number; denom: number };

function addAgg(m: Map<string, Agg>, key: string, present: boolean) {
  const cur = m.get(key) ?? { numer: 0, denom: 0 };
  cur.denom += 1;
  if (present) cur.numer += 1;
  m.set(key, cur);
}

function pct(a: Agg): number | null {
  if (a.denom === 0) return null;
  return Math.round((a.numer / a.denom) * 1000) / 10;
}

function topSeriesByVolume(
  seriesData: Map<string, Map<string, Agg>>,
  weekKeys: string[],
  limit: number,
): string[] {
  const totals = new Map<string, number>();
  for (const [sk, wm] of seriesData) {
    let t = 0;
    for (const wk of weekKeys) {
      t += wm.get(wk)?.denom ?? 0;
    }
    totals.set(sk, t);
  }
  return [...totals.entries()]
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

/**
 * Недельная динамика посещаемости (П+О / все отметки) по текущему семестру.
 */
export async function buildAcadepartmentAttendanceCharts(): Promise<{
  weekLabels: string[];
  facultyCourse: AcadepartmentChartSeries[];
  byProgram: AcadepartmentChartSeries[];
  semesterName: string | null;
  emptyMessage: string | null;
}> {
  const semester = await resolveSemester();
  if (!semester) {
    return {
      weekLabels: [],
      facultyCourse: [],
      byProgram: [],
      semesterName: null,
      emptyMessage: "В системе нет семестра — графики недоступны.",
    };
  }

  const groups = await prisma.group.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      code: true,
      program: {
        select: {
          id: true,
          name: true,
          faculty: { select: { id: true, name: true } },
        },
      },
    },
  });

  const labelsForMax = groups.map((g) => g.code ?? g.name);
  const maxCohortYear = computeMaxCohortYearFromLabels(labelsForMax);

  const groupMeta = new Map<
    string,
    {
      facultyId: string | null;
      facultyLabel: string;
      programId: string | null;
      programLabel: string | null;
      course: number | null;
    }
  >();

  for (const g of groups) {
    const lab = g.code ?? g.name;
    const cohort = extractCohortYearFromGroupLabel(lab);
    const course = computeCourseNumber({ cohortYear: cohort, maxCohortYear });
    const facultyId = g.program?.faculty?.id ?? null;
    const facultyLabel = g.program?.faculty?.name ?? "Без факультета";
    const programId = g.program?.id ?? null;
    const programLabel = g.program?.name ?? null;
    groupMeta.set(g.id, {
      facultyId,
      facultyLabel,
      programId,
      programLabel,
      course,
    });
  }

  const now = new Date();
  const rangeEnd = dfMin([semester.endDate, now]);
  const rangeStart = semester.startDate;

  if (rangeStart > rangeEnd) {
    return {
      weekLabels: [],
      facultyCourse: [],
      byProgram: [],
      semesterName: semester.name,
      emptyMessage: "Некорректный интервал семестра.",
    };
  }

  const weekStarts = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 }).map((d) =>
    startOfWeek(d, { weekStartsOn: 1 }),
  );

  const weekKeys = weekStarts.map((d) => format(d, "yyyy-MM-dd"));
  const weekLabels = weekStarts.map((d) => format(d, "d MMM", { locale: ru }));

  if (weekKeys.length === 0) {
    return {
      weekLabels: [],
      facultyCourse: [],
      byProgram: [],
      semesterName: semester.name,
      emptyMessage: "Нет интервала дат для отображения.",
    };
  }

  const attendances = await prisma.attendance.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      statusV2: { not: null },
      classSession: {
        semesterId: semester.id,
        isActive: true,
        deletedAt: null,
        NOT: [{ statusV2: "cancelled" }, { status: "cancelled" }],
      },
    },
    select: {
      statusV2: true,
      classSession: {
        select: {
          startTime: true,
          groupId: true,
        },
      },
    },
  });

  const fcData = new Map<string, Map<string, Agg>>();
  const progData = new Map<string, Map<string, Agg>>();

  for (const a of attendances) {
    const gid = a.classSession.groupId;
    const meta = groupMeta.get(gid);
    if (!meta) continue;
    const st = a.classSession.startTime;
    if (st < rangeStart || st > rangeEnd) continue;

    const wk = format(startOfWeek(st, { weekStartsOn: 1 }), "yyyy-MM-dd");
    if (!weekKeys.includes(wk)) continue;

    const present = isPresent(a.statusV2);

    if (meta.course !== null && meta.facultyId !== null) {
      const fk = `${meta.facultyId}__c${meta.course}`;
      if (!fcData.has(fk)) fcData.set(fk, new Map());
      addAgg(fcData.get(fk)!, wk, present);
    } else if (meta.course !== null) {
      const fk = `nofac__c${meta.course}`;
      if (!fcData.has(fk)) fcData.set(fk, new Map());
      addAgg(fcData.get(fk)!, wk, present);
    }

    if (meta.programId && meta.programLabel) {
      const pk = meta.programId;
      if (!progData.has(pk)) progData.set(pk, new Map());
      addAgg(progData.get(pk)!, wk, present);
    }
  }

  const fcIds = topSeriesByVolume(fcData, weekKeys, 14);
  const fcLabels = new Map<string, string>();
  for (const g of groups) {
    const meta = groupMeta.get(g.id);
    if (!meta || meta.course === null) continue;
    const fk = meta.facultyId !== null ? `${meta.facultyId}__c${meta.course}` : `nofac__c${meta.course}`;
    if (!fcLabels.has(fk)) {
      fcLabels.set(fk, `${meta.facultyLabel} · ${meta.course} курс`);
    }
  }

  const facultyCourse: AcadepartmentChartSeries[] = fcIds.map((id) => {
    const wm = fcData.get(id)!;
    const points = weekKeys.map((wk) => {
      const row = wm.get(wk);
      return row ? pct(row) : null;
    });
    return { id, label: fcLabels.get(id) ?? id, points };
  });

  const progIds = topSeriesByVolume(progData, weekKeys, 12);
  const programs =
    progIds.length === 0
      ? []
      : await prisma.program.findMany({
          where: { id: { in: progIds } },
          select: { id: true, name: true },
        });
  const progLabelById = new Map(programs.map((p) => [p.id, p.name]));

  const byProgram: AcadepartmentChartSeries[] = progIds.map((pid) => {
    const wm = progData.get(pid)!;
    const points = weekKeys.map((wk) => {
      const row = wm.get(wk);
      return row ? pct(row) : null;
    });
    return {
      id: pid,
      label: progLabelById.get(pid) ?? pid,
      points,
    };
  });

  const emptyMessage =
    attendances.length === 0 ? "За семестр пока нет отметок посещаемости для графиков." : null;

  return {
    weekLabels,
    facultyCourse,
    byProgram,
    semesterName: semester.name,
    emptyMessage,
  };
}
