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

/** Как у кнопки «Назад» в `ExitButton`. */
const outlineNavStyle: React.CSSProperties = {
  appearance: "none",
  border: "1px solid #111827",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 900,
  fontFamily: "inherit",
  fontSize: "inherit",
  lineHeight: "inherit",
  textDecoration: "none",
  color: "#111827",
  background: "white",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const primaryBuildStyle: React.CSSProperties = {
  ...outlineNavStyle,
  background: "#111827",
  color: "white",
  borderColor: "#111827",
};

type Series = { id: string; label: string; points: (number | null)[] };

function parseSeriesKey(id: string): { prefix: string; course: number } | null {
  const i = id.lastIndexOf("__c");
  if (i < 0) return null;
  const course = Number(id.slice(i + 3));
  if (!Number.isFinite(course)) return null;
  return { prefix: id.slice(0, i), course };
}

function applyDateSlice(
  weekKeys: string[],
  weekLabels: string[],
  series: Series[],
  fromIso: string,
  toIso: string,
): { weekLabels: string[]; series: Series[] } {
  if (weekKeys.length === 0) {
    return { weekLabels: [], series: series.map((s) => ({ ...s, points: [] })) };
  }
  let from = (fromIso || weekKeys[0]).trim();
  let to = (toIso || weekKeys[weekKeys.length - 1]).trim();
  if (from > to) {
    const t = from;
    from = to;
    to = t;
  }
  const start = weekKeys.findIndex((k) => k >= from);
  if (start < 0) {
    return { weekLabels: [], series: series.map((s) => ({ ...s, points: [] })) };
  }
  let end = start;
  for (let i = start; i < weekKeys.length; i++) {
    if (weekKeys[i] <= to) end = i;
  }
  const wl = weekLabels.slice(start, end + 1);
  const sr = series.map((s) => ({ ...s, points: s.points.slice(start, end + 1) }));
  return { weekLabels: wl, series: sr };
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
      <section style={{ marginTop: 16, borderRadius: 14, border: "1px solid #e5e7eb", background: "white", padding: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>{title}</h2>
        <p style={{ marginTop: 12, fontSize: 14, color: "#6b7280" }}>{emptyHint ?? "Нет данных для графика в выбранном диапазоне дат."}</p>
      </section>
    );
  }

  const gridYs = [0, 25, 50, 75, 100];

  return (
    <section style={{ marginTop: 16, borderRadius: 14, border: "1px solid #e5e7eb", background: "white", padding: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>{title}</h2>
      {emptyHint ? <p style={{ marginTop: 6, fontSize: 14, color: "#92400e" }}>{emptyHint}</p> : null}

      <div style={{ marginTop: 16, width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ height: "min(360px, 70vw)", width: "100%", minWidth: 520 }} preserveAspectRatio="xMidYMid meet">
          {gridYs.map((g) => (
            <g key={g}>
              <line x1={padL} y1={yAt(g)} x2={W - padR} y2={yAt(g)} stroke="#e5e7eb" strokeWidth={g === 0 || g === 100 ? 1.5 : 1} />
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
        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 16px",
            borderTop: "1px solid #f3f4f6",
            paddingTop: 12,
            fontSize: 12,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          {series.map((s, si) => (
            <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", height: 8, width: 12, borderRadius: 2, background: COLORS[si % COLORS.length] }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : (
        <p style={{ marginTop: 12, fontSize: 14, color: "#6b7280" }}>Нет рядов — выберите фильтры или расширьте диапазон дат.</p>
      )}
    </section>
  );
}

function useDropdownClose(open: boolean, setOpen: (v: boolean) => void) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, setOpen]);
  return ref;
}

function MultiSelectDropdown(props: {
  label: string;
  options: AcadepartmentFilterOption[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = useDropdownClose(open, setOpen);

  if (props.options.length === 0) {
    return <p style={{ fontSize: 14, color: "#6b7280" }}>{props.label}: нет вариантов в данных.</p>;
  }

  const n = props.selectedIds.size;
  const summary =
    n === 0 ? "ничего не выбрано" : n === props.options.length ? `все (${n})` : `выбрано: ${n}`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          ...outlineNavStyle,
          width: "100%",
          justifyContent: "space-between",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span>
          {props.label}: {summary}
        </span>
        <span style={{ marginLeft: 8, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            zIndex: 40,
            marginTop: 6,
            maxHeight: 280,
            overflowY: "auto",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            boxShadow: "0 10px 40px rgba(15, 23, 42, 0.12)",
            padding: 12,
          }}
        >
          <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 12, fontWeight: 800 }}>
            <button type="button" style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0 }} onClick={props.onSelectAll}>
              все
            </button>
            <button type="button" style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0 }} onClick={props.onClear}>
              снять
            </button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {props.options.map((o) => (
              <label
                key={o.id}
                style={{
                  display: "flex",
                  cursor: "pointer",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                <input
                  type="checkbox"
                  checked={props.selectedIds.has(o.id)}
                  onChange={() => props.onToggle(o.id)}
                  style={{ marginTop: 2, width: 16, height: 16 }}
                />
                <span>{o.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CourseMultiSelectDropdown(props: {
  courses: number[];
  selected: Set<number>;
  onToggle: (c: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = useDropdownClose(open, setOpen);

  if (props.courses.length === 0) {
    return <p style={{ fontSize: 14, color: "#6b7280" }}>Курсы: нет в данных.</p>;
  }

  const n = props.selected.size;
  const summary =
    n === 0 ? "ничего не выбрано" : n === props.courses.length ? `все (${n})` : `выбрано: ${n}`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          ...outlineNavStyle,
          width: "100%",
          justifyContent: "space-between",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span>
          Курс: {summary}
        </span>
        <span style={{ marginLeft: 8, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            zIndex: 40,
            marginTop: 6,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "white",
            boxShadow: "0 10px 40px rgba(15, 23, 42, 0.12)",
            padding: 12,
          }}
        >
          <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 12, fontWeight: 800 }}>
            <button type="button" style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0 }} onClick={props.onSelectAll}>
              все
            </button>
            <button type="button" style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0 }} onClick={props.onClear}>
              снять
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {props.courses.map((c) => (
              <label
                key={c}
                style={{ display: "inline-flex", cursor: "pointer", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, color: "#111827" }}
              >
                <input
                  type="checkbox"
                  checked={props.selected.has(c)}
                  onChange={() => props.onToggle(c)}
                  style={{ width: 16, height: 16 }}
                />
                {c}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const dateLabelStyle: React.CSSProperties = { display: "grid", gap: 6, fontWeight: 800, fontSize: 14, color: "#374151" };
const dateInputStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 14,
  color: "#111827",
};

export function AcadepartmentChartsWithFilters(props: {
  weekKeys: string[];
  weekLabels: string[];
  emptyHint: string | null;
  facultyCourseSeries: Series[];
  programCourseSeries: Series[];
  facultyOptions: AcadepartmentFilterOption[];
  programOptions: AcadepartmentFilterOption[];
  courseOptions: number[];
  semesterStartIso: string | null;
  semesterEndIso: string | null;
}) {
  const {
    facultyOptions,
    programOptions,
    courseOptions,
    weekKeys,
    weekLabels,
    semesterStartIso,
    semesterEndIso,
  } = props;

  const defaultFrom = semesterStartIso ?? "";
  const defaultTo = semesterEndIso ?? "";

  const [facSelected, setFacSelected] = React.useState<Set<string>>(() => new Set(facultyOptions.map((f) => f.id)));
  const [progSelected, setProgSelected] = React.useState<Set<string>>(() => new Set(programOptions.map((p) => p.id)));
  const [fcCourses, setFcCourses] = React.useState<Set<number>>(() => new Set(courseOptions));
  const [pcCourses, setPcCourses] = React.useState<Set<number>>(() => new Set(courseOptions));

  const [fcFrom, setFcFrom] = React.useState(defaultFrom);
  const [fcTo, setFcTo] = React.useState(defaultTo);
  const [pcFrom, setPcFrom] = React.useState(defaultFrom);
  const [pcTo, setPcTo] = React.useState(defaultTo);

  const [showFacultyChart, setShowFacultyChart] = React.useState(false);
  const [showProgramChart, setShowProgramChart] = React.useState(false);

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

  React.useEffect(() => {
    const f = semesterStartIso ?? "";
    const t = semesterEndIso ?? "";
    setFcFrom(f);
    setFcTo(t);
    setPcFrom(f);
    setPcTo(t);
  }, [semesterStartIso, semesterEndIso]);

  const chart1SeriesFiltered = React.useMemo(() => {
    return props.facultyCourseSeries.filter((s) => {
      const p = parseSeriesKey(s.id);
      if (!p) return false;
      return facSelected.has(p.prefix) && fcCourses.has(p.course);
    });
  }, [props.facultyCourseSeries, facSelected, fcCourses]);

  const chart2SeriesFiltered = React.useMemo(() => {
    return props.programCourseSeries.filter((s) => {
      const p = parseSeriesKey(s.id);
      if (!p) return false;
      return progSelected.has(p.prefix) && pcCourses.has(p.course);
    });
  }, [props.programCourseSeries, progSelected, pcCourses]);

  const chart1Display = React.useMemo(
    () => applyDateSlice(weekKeys, weekLabels, chart1SeriesFiltered, fcFrom, fcTo),
    [weekKeys, weekLabels, chart1SeriesFiltered, fcFrom, fcTo],
  );

  const chart2Display = React.useMemo(
    () => applyDateSlice(weekKeys, weekLabels, chart2SeriesFiltered, pcFrom, pcTo),
    [weekKeys, weekLabels, chart2SeriesFiltered, pcFrom, pcTo],
  );

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

  const hint =
    props.emptyHint ??
    (weekKeys.length === 0 ? "Нет недельного интервала для графика в текущем семестре." : null);

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>Диаграмма: факультеты и курсы</div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <label style={dateLabelStyle}>
              С
              <input
                type="date"
                value={fcFrom}
                min={semesterStartIso ?? undefined}
                max={semesterEndIso ?? undefined}
                onChange={(e) => setFcFrom(e.target.value)}
                style={dateInputStyle}
              />
            </label>
            <label style={dateLabelStyle}>
              По
              <input
                type="date"
                value={fcTo}
                min={semesterStartIso ?? undefined}
                max={semesterEndIso ?? undefined}
                onChange={(e) => setFcTo(e.target.value)}
                style={dateInputStyle}
              />
            </label>
          </div>

          <MultiSelectDropdown
            label="Факультеты"
            options={facultyOptions}
            selectedIds={facSelected}
            onToggle={toggleFac}
            onSelectAll={() => setFacSelected(new Set(facultyOptions.map((f) => f.id)))}
            onClear={() => setFacSelected(new Set())}
          />

          <CourseMultiSelectDropdown
            courses={courseOptions}
            selected={fcCourses}
            onToggle={toggleFcCourse}
            onSelectAll={() => setFcCourses(new Set(courseOptions))}
            onClear={() => setFcCourses(new Set())}
          />

          <div>
            <button type="button" style={primaryBuildStyle} onClick={() => setShowFacultyChart(true)}>
              Построить
            </button>
          </div>

          {!showFacultyChart ? (
            <p style={{ margin: 0, fontSize: 14, color: "#6b7280", fontWeight: 600 }}>
              Диаграмма скрыта. Настройте фильтры и нажмите «Построить».
            </p>
          ) : (
            <LineChartBlock
              title="Динамика посещаемости по факультетам и курсам"
              weekLabels={chart1Display.weekLabels}
              series={chart1Display.series}
              emptyHint={hint}
            />
          )}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>Диаграмма: направления и курсы</div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <label style={dateLabelStyle}>
              С
              <input
                type="date"
                value={pcFrom}
                min={semesterStartIso ?? undefined}
                max={semesterEndIso ?? undefined}
                onChange={(e) => setPcFrom(e.target.value)}
                style={dateInputStyle}
              />
            </label>
            <label style={dateLabelStyle}>
              По
              <input
                type="date"
                value={pcTo}
                min={semesterStartIso ?? undefined}
                max={semesterEndIso ?? undefined}
                onChange={(e) => setPcTo(e.target.value)}
                style={dateInputStyle}
              />
            </label>
          </div>

          <MultiSelectDropdown
            label="Направления"
            options={programOptions}
            selectedIds={progSelected}
            onToggle={toggleProg}
            onSelectAll={() => setProgSelected(new Set(programOptions.map((p) => p.id)))}
            onClear={() => setProgSelected(new Set())}
          />

          <CourseMultiSelectDropdown
            courses={courseOptions}
            selected={pcCourses}
            onToggle={togglePcCourse}
            onSelectAll={() => setPcCourses(new Set(courseOptions))}
            onClear={() => setPcCourses(new Set())}
          />

          <div>
            <button type="button" style={primaryBuildStyle} onClick={() => setShowProgramChart(true)}>
              Построить
            </button>
          </div>

          {!showProgramChart ? (
            <p style={{ margin: 0, fontSize: 14, color: "#6b7280", fontWeight: 600 }}>
              Диаграмма скрыта. Настройте фильтры и нажмите «Построить».
            </p>
          ) : (
            <LineChartBlock
              title="Динамика посещаемости по направлениям подготовки и курсам"
              weekLabels={chart2Display.weekLabels}
              series={chart2Display.series}
              emptyHint={hint}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Кнопки навигации в стиле «Назад» (`ExitButton`). */
export function AcadepartmentNavButtons() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Link href="/acadepartment/ratings" style={outlineNavStyle}>
        Рейтинг
      </Link>
      <Link href="/admin/semester" style={outlineNavStyle}>
        Семестр
      </Link>
    </div>
  );
}
