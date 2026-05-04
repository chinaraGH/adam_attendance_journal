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

function mapToSeries(
  data: Map<string, Map<string, Agg>>,
  weekKeys: string[],
  labelById: Map<string, string>,
): AcadepartmentChartSeries[] {
  const keys = [...data.keys()].sort((a, b) => (labelById.get(a) ?? a).localeCompare(labelById.get(b) ?? b, "ru"));
  return keys.map((id) => {
    const wm = data.get(id)!;
    const points = weekKeys.map((wk) => {
      const row = wm.get(wk);
      return row ? pct(row) : null;
    });
    return { id, label: labelById.get(id) ?? id, points };
  });
}

/** Недельные числитель/знаменатель для агрегации П+О за произвольный диапазон дат на клиенте. */
export type AcadepartmentWeeklySeries = {
  id: string;
  label: string;
  weekNumer: number[];
  weekDenom: number[];
};

function mapToWeeklySeries(
  data: Map<string, Map<string, Agg>>,
  weekKeys: string[],
  labelById: Map<string, string>,
): AcadepartmentWeeklySeries[] {
  const keys = [...data.keys()].sort((a, b) => (labelById.get(a) ?? a).localeCompare(labelById.get(b) ?? b, "ru"));
  return keys.map((id) => {
    const wm = data.get(id)!;
    const weekNumer = weekKeys.map((wk) => wm.get(wk)?.numer ?? 0);
    const weekDenom = weekKeys.map((wk) => wm.get(wk)?.denom ?? 0);
    return { id, label: labelById.get(id) ?? id, weekNumer, weekDenom };
  });
}

export type AcadepartmentFilterOption = { id: string; name: string };

/**
 * Недельная динамика посещаемости (П+О / все отметки) по текущему семестру.
 * Все ряды «факультет×курс» и «направление×курс» отдаются для фильтрации на клиенте.
 */
export async function buildAcadepartmentAttendanceCharts(): Promise<{
  weekKeys: string[];
  weekLabels: string[];
  facultyCourse: AcadepartmentChartSeries[];
  programCourse: AcadepartmentChartSeries[];
  facultyCourseWeekly: AcadepartmentWeeklySeries[];
  programCourseWeekly: AcadepartmentWeeklySeries[];
  semesterName: string | null;
  semesterStartIso: string | null;
  semesterEndIso: string | null;
  emptyMessage: string | null;
  facultyOptions: AcadepartmentFilterOption[];
  programOptions: AcadepartmentFilterOption[];
  courseOptions: number[];
}> {
  const semester = await resolveSemester();
  if (!semester) {
    return {
      weekKeys: [],
      weekLabels: [],
      facultyCourse: [],
      programCourse: [],
      facultyCourseWeekly: [],
      programCourseWeekly: [],
      semesterName: null,
      semesterStartIso: null,
      semesterEndIso: null,
      emptyMessage: "В системе нет семестра — графики недоступны.",
      facultyOptions: [],
      programOptions: [],
      courseOptions: [],
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

  const semesterStartIso = format(semester.startDate, "yyyy-MM-dd");
  const semesterEndIso = format(semester.endDate, "yyyy-MM-dd");

  if (rangeStart > rangeEnd) {
    return {
      weekKeys: [],
      weekLabels: [],
      facultyCourse: [],
      programCourse: [],
      facultyCourseWeekly: [],
      programCourseWeekly: [],
      semesterName: semester.name,
      semesterStartIso,
      semesterEndIso,
      emptyMessage: "Некорректный интервал семестра.",
      facultyOptions: [],
      programOptions: [],
      courseOptions: [],
    };
  }

  const weekStarts = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 }).map((d) =>
    startOfWeek(d, { weekStartsOn: 1 }),
  );

  const weekKeys = weekStarts.map((d) => format(d, "yyyy-MM-dd"));
  const weekLabels = weekStarts.map((d) => format(d, "d MMM", { locale: ru }));

  if (weekKeys.length === 0) {
    return {
      weekKeys: [],
      weekLabels: [],
      facultyCourse: [],
      programCourse: [],
      facultyCourseWeekly: [],
      programCourseWeekly: [],
      semesterName: semester.name,
      semesterStartIso,
      semesterEndIso,
      emptyMessage: "Нет интервала дат для отображения.",
      facultyOptions: [],
      programOptions: [],
      courseOptions: [],
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
  const pcData = new Map<string, Map<string, Agg>>();

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

    if (meta.programId && meta.programLabel && meta.course !== null) {
      const pk = `${meta.programId}__c${meta.course}`;
      if (!pcData.has(pk)) pcData.set(pk, new Map());
      addAgg(pcData.get(pk)!, wk, present);
    }
  }

  const fcLabels = new Map<string, string>();
  const facultyIdsSeen = new Map<string, string>();
  for (const g of groups) {
    const meta = groupMeta.get(g.id);
    if (!meta || meta.course === null) continue;
    const fk = meta.facultyId !== null ? `${meta.facultyId}__c${meta.course}` : `nofac__c${meta.course}`;
    if (!fcLabels.has(fk)) {
      fcLabels.set(fk, `${meta.facultyLabel} · ${meta.course} курс`);
    }
    const fid = meta.facultyId ?? "nofac";
    if (!facultyIdsSeen.has(fid)) {
      facultyIdsSeen.set(fid, meta.facultyLabel);
    }
  }

  const pcLabels = new Map<string, string>();
  const programIdsSeen = new Map<string, string>();
  for (const g of groups) {
    const meta = groupMeta.get(g.id);
    if (!meta?.programId || meta.course === null || !meta.programLabel) continue;
    const pk = `${meta.programId}__c${meta.course}`;
    if (!pcLabels.has(pk)) {
      pcLabels.set(pk, `${meta.programLabel} · ${meta.course} курс`);
    }
    if (!programIdsSeen.has(meta.programId)) {
      programIdsSeen.set(meta.programId, meta.programLabel);
    }
  }

  const facultyCourse = mapToSeries(fcData, weekKeys, fcLabels);
  const programCourse = mapToSeries(pcData, weekKeys, pcLabels);
  const facultyCourseWeekly = mapToWeeklySeries(fcData, weekKeys, fcLabels);
  const programCourseWeekly = mapToWeeklySeries(pcData, weekKeys, pcLabels);

  const facultyOptions: AcadepartmentFilterOption[] = [...facultyIdsSeen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const programOptions: AcadepartmentFilterOption[] = [...programIdsSeen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const courseSet = new Set<number>();
  for (const g of groups) {
    const c = groupMeta.get(g.id)?.course;
    if (c !== null && c !== undefined) courseSet.add(c);
  }
  const courseOptions = [...courseSet].sort((a, b) => a - b);

  const emptyMessage =
    attendances.length === 0 ? "За семестр пока нет отметок посещаемости для графиков." : null;

  return {
    weekKeys,
    weekLabels,
    facultyCourse,
    programCourse,
    facultyCourseWeekly,
    programCourseWeekly,
    semesterName: semester.name,
    semesterStartIso,
    semesterEndIso,
    emptyMessage,
    facultyOptions,
    programOptions,
    courseOptions,
  };
}
