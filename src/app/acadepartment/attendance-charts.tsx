"use client";

import Link from "next/link";
import * as React from "react";

import type { AcadepartmentFilterOption } from "@/lib/academic/build-acadepartment-charts";

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0d9488",
  "#db2777",
  "#4b5563",
  "#ca8a04",
  "#4338ca",
  "#15803d",
  "#b91c1c",
  "#0e7490",
  "#a21caf",
  "#b45309",
];

type Series = { id: string; label: string; points: (number | null)[] };

function parseSeriesKey(id: string): { prefix: string; course: number } | null {
  const i = id.lastIndexOf("__c");
  if (i < 0) return null;
  const course = Number(id.slice(i + 3));
  if (!Number.isFinite(course)) return null;
  return { prefix: id.slice(0, i), course };
}

function LineChartBlock(props: { title: string; weekLabels: string[]; series: Series[]; emptyHint: string | null }) {
  const { title, weekLabels, series, emptyHint } = props;
  const W = 1000;
  const H = 320;
  const padL = 48;
  const padR = 24;
  const padT = 20;
  const padB = 80;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = weekLabels.length;
  const xAt = (i: number) => (n <= 1 ? padL + innerW / 2 : padL + (innerW * i) / (n - 1));
  const yAt = (pct: number) => padT + innerH * (1 - pct / 100);

  if (n === 0) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black text-gray-900">{title}</h2>
        <p className="mt-3 text-sm text-gray-600">{emptyHint ?? "Нет данных для графика."}</p>
      </section>
    );
  }

  const gridYs = [0, 25, 50, 75, 100];

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-gray-900">{title}</h2>
      {emptyHint ? <p className="mt-1 text-sm text-amber-800">{emptyHint}</p> : null}

      <div className="mt-4 w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[min(360px,70vw)] w-full min-w-[520px]" preserveAspectRatio="xMidYMid meet">
          {gridYs.map((g) => (
            <g key={g}>
              <line
                x1={padL}
                y1={yAt(g)}
                x2={W - padR}
                y2={yAt(g)}
                stroke="#e5e7eb"
                strokeWidth={g === 0 || g === 100 ? 1.5 : 1}
              />
              <text x={8} y={yAt(g) + 4} fontSize={12} fill="#6b7280" fontWeight={700}>
                {g}%
              </text>
            </g>
          ))}

          {weekLabels.map((_, i) => (
            <text
              key={weekLabels[i]}
              x={xAt(i)}
              y={H - 40}
              fontSize={11}
              fill="#374151"
              fontWeight={600}
              textAnchor="middle"
              transform={`rotate(-35 ${xAt(i)} ${H - 40})`}
            >
              {weekLabels[i]}
            </text>
          ))}

          {series.map((s, si) => {
            const color = COLORS[si % COLORS.length];
            const lines: React.ReactNode[] = [];
            for (let i = 0; i < s.points.length - 1; i++) {
              const a = s.points[i];
              const b = s.points[i + 1];
              if (a === null || b === null) continue;
              lines.push(
                <line
                  key={`${s.id}-seg-${i}`}
                  x1={xAt(i)}
                  y1={yAt(a)}
                  x2={xAt(i + 1)}
                  y2={yAt(b)}
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />,
              );
            }
            return <g key={s.id}>{lines}</g>;
          })}

          {series.map((s, si) => {
            const color = COLORS[si % COLORS.length];
            return s.points.map((p, i) =>
              p === null ? null : (
                <circle key={`${s.id}-${i}`} cx={xAt(i)} cy={yAt(p)} r={3.5} fill={color} stroke="white" strokeWidth={1} />
              ),
            );
          })}
        </svg>
      </div>

      {series.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs font-bold text-gray-800">
          {series.map((s, si) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: COLORS[si % COLORS.length] }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-600">Нет рядов для отображения — выберите фильтры или проверьте данные.</p>
      )}
    </section>
  );
}

function CheckboxGrid(props: {
  title: string;
  options: AcadepartmentFilterOption[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  if (props.options.length === 0) {
    return <p className="text-sm text-gray-500">{props.title}: нет вариантов в данных.</p>;
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-gray-800">{props.title}</span>
        <button
          type="button"
          className="text-xs font-bold text-blue-700 underline"
          onClick={props.onSelectAll}
        >
          все
        </button>
        <button type="button" className="text-xs font-bold text-gray-600 underline" onClick={props.onClear}>
          снять
        </button>
      </div>
      <div className="flex max-h-36 flex-wrap gap-x-4 gap-y-2 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/80 p-3">
        {props.options.map((o) => (
          <label key={o.id} className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-gray-800">
            <input
              type="checkbox"
              checked={props.selectedIds.has(o.id)}
              onChange={() => props.onToggle(o.id)}
              className="h-4 w-4 rounded border-gray-400"
            />
            {o.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function CourseCheckboxes(props: {
  courses: number[];
  selected: Set<number>;
  onToggle: (c: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  if (props.courses.length === 0) {
    return <p className="text-sm text-gray-500">Курсы: нет в данных.</p>;
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-gray-800">Курс</span>
        <button type="button" className="text-xs font-bold text-blue-700 underline" onClick={props.onSelectAll}>
          все
        </button>
        <button type="button" className="text-xs font-bold text-gray-600 underline" onClick={props.onClear}>
          снять
        </button>
      </div>
      <div className="flex flex-wrap gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
        {props.courses.map((c) => (
          <label key={c} className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-gray-800">
            <input
              type="checkbox"
              checked={props.selected.has(c)}
              onChange={() => props.onToggle(c)}
              className="h-4 w-4 rounded border-gray-400"
            />
            {c}
          </label>
        ))}
      </div>
    </div>
  );
}

export function AcadepartmentChartsWithFilters(props: {
  weekLabels: string[];
  emptyHint: string | null;
  facultyCourseSeries: Series[];
  programCourseSeries: Series[];
  facultyOptions: AcadepartmentFilterOption[];
  programOptions: AcadepartmentFilterOption[];
  courseOptions: number[];
}) {
  const { facultyOptions, programOptions, courseOptions } = props;

  const [facSelected, setFacSelected] = React.useState<Set<string>>(() => new Set(facultyOptions.map((f) => f.id)));
  const [progSelected, setProgSelected] = React.useState<Set<string>>(() => new Set(programOptions.map((p) => p.id)));
  const [fcCourses, setFcCourses] = React.useState<Set<number>>(() => new Set(courseOptions));
  const [pcCourses, setPcCourses] = React.useState<Set<number>>(() => new Set(courseOptions));

  React.useEffect(() => {
    setFacSelected(new Set(facultyOptions.map((f) => f.id)));
  }, [facultyOptions]);

  React.useEffect(() => {
    setProgSelected(new Set(programOptions.map((p) => p.id)));
  }, [programOptions]);

  React.useEffect(() => {
    setFcCourses(new Set(courseOptions));
    setPcCourses(new Set(courseOptions));
  }, [courseOptions]);

  const chart1 = React.useMemo(() => {
    return props.facultyCourseSeries.filter((s) => {
      const p = parseSeriesKey(s.id);
      if (!p) return false;
      return facSelected.has(p.prefix) && fcCourses.has(p.course);
    });
  }, [props.facultyCourseSeries, facSelected, fcCourses]);

  const chart2 = React.useMemo(() => {
    return props.programCourseSeries.filter((s) => {
      const p = parseSeriesKey(s.id);
      if (!p) return false;
      return progSelected.has(p.prefix) && pcCourses.has(p.course);
    });
  }, [props.programCourseSeries, progSelected, pcCourses]);

  const toggleFac = (id: string) => {
    setFacSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleProg = (id: string) => {
    setProgSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleFcCourse = (c: number) => {
    setFcCourses((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  const togglePcCourse = (c: number) => {
    setPcCourses((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  return (
    <div className="grid gap-10">
      <div className="grid gap-4">
        <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-black text-gray-900">Фильтры первой диаграммы (факультет и курс)</div>
          <CheckboxGrid
            title="Факультет"
            options={facultyOptions}
            selectedIds={facSelected}
            onToggle={toggleFac}
            onSelectAll={() => setFacSelected(new Set(facultyOptions.map((f) => f.id)))}
            onClear={() => setFacSelected(new Set())}
          />
          <CourseCheckboxes
            courses={courseOptions}
            selected={fcCourses}
            onToggle={toggleFcCourse}
            onSelectAll={() => setFcCourses(new Set(courseOptions))}
            onClear={() => setFcCourses(new Set())}
          />
        </div>

        <LineChartBlock
          title="Динамика посещаемости по факультетам и курсам"
          weekLabels={props.weekLabels}
          series={chart1}
          emptyHint={props.emptyHint}
        />
      </div>

      <div className="grid gap-4">
        <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-black text-gray-900">Фильтры второй диаграммы (направление и курс)</div>
          <CheckboxGrid
            title="Направление"
            options={programOptions}
            selectedIds={progSelected}
            onToggle={toggleProg}
            onSelectAll={() => setProgSelected(new Set(programOptions.map((p) => p.id)))}
            onClear={() => setProgSelected(new Set())}
          />
          <CourseCheckboxes
            courses={courseOptions}
            selected={pcCourses}
            onToggle={togglePcCourse}
            onSelectAll={() => setPcCourses(new Set(courseOptions))}
            onClear={() => setPcCourses(new Set())}
          />
        </div>

        <LineChartBlock
          title="Динамика посещаемости по направлениям подготовки и курсам"
          weekLabels={props.weekLabels}
          series={chart2}
          emptyHint={props.emptyHint}
        />
      </div>
    </div>
  );
}

/** Кнопки навигации (вид кнопок, не текстовые ссылки). */
export function AcadepartmentNavButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/acadepartment/ratings"
        className="inline-flex items-center justify-center rounded-lg border-2 border-gray-900 bg-gray-900 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-gray-800"
      >
        Рейтинг
      </Link>
      <Link
        href="/admin/semester"
        className="inline-flex items-center justify-center rounded-lg border-2 border-gray-900 bg-white px-5 py-2.5 text-sm font-black text-gray-900 shadow-sm transition hover:bg-gray-50"
      >
        Семестр
      </Link>
    </div>
  );
}
