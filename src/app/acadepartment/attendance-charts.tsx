"use client";

import Link from "next/link";
import * as React from "react";

import type { AcadepartmentFilterOption, AcadepartmentWeeklySeries } from "@/lib/academic/build-acadepartment-charts";

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

function parseSeriesKey(id: string): { prefix: string; course: number } | null {
  const i = id.lastIndexOf("__c");
  if (i < 0) return null;
  const course = Number(id.slice(i + 3));
  if (!Number.isFinite(course)) return null;
  return { prefix: id.slice(0, i), course };
}

function weeklyById(list: AcadepartmentWeeklySeries[]): Map<string, AcadepartmentWeeklySeries> {
  return new Map(list.map((s) => [s.id, s]));
}

function aggregateWeeklyRange(
  s: AcadepartmentWeeklySeries,
  weekKeys: string[],
  fromIso: string,
  toIso: string,
): { numer: number; denom: number } {
  if (weekKeys.length === 0) return { numer: 0, denom: 0 };
  let from = (fromIso || weekKeys[0]).trim();
  let to = (toIso || weekKeys[weekKeys.length - 1]).trim();
  if (from > to) {
    const x = from;
    from = to;
    to = x;
  }
  let numer = 0;
  let denom = 0;
  for (let i = 0; i < weekKeys.length; i++) {
    if (weekKeys[i] >= from && weekKeys[i] <= to) {
      numer += s.weekNumer[i] ?? 0;
      denom += s.weekDenom[i] ?? 0;
    }
  }
  return { numer, denom };
}

function pctAgg(numer: number, denom: number): number | null {
  if (denom <= 0) return null;
  return Math.round((numer / denom) * 1000) / 10;
}

function truncateLabel(s: string, max = 48): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function ClusteredHistogram(props: {
  title: string;
  categories: string[];
  legendLabels: string[];
  values: (number | null)[][];
  emptyHint: string | null;
}) {
  const { title, categories, legendLabels, values, emptyHint } = props;
  const K = categories.length;
  const B = legendLabels.length;

  const hasDataPoint = values.some((row) =>
    row.some((v) => v !== null && v !== undefined && !Number.isNaN(v as number)),
  );

  const W = 1000;
  const H = 400;
  const padL = 52;
  const padR = 24;
  const padT = 36;
  const padB = 112;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const yAt = (pct: number) => padT + innerH * (1 - pct / 100);
  const gridYs = [0, 25, 50, 75, 100];
  const baselineY = padT + innerH;

  if (K === 0 || B === 0) {
    return (
      <section style={{ marginTop: 16, borderRadius: 14, border: "1px solid #e5e7eb", background: "white", padding: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>{title}</h2>
        <p style={{ marginTop: 12, fontSize: 14, color: "#6b7280" }}>
          {emptyHint ?? "Нет данных за выбранный период и фильтры."}
        </p>
      </section>
    );
  }

  const catW = innerW / K;
  const clusterPad = 0.06;
  const innerClusterW = catW * (1 - 2 * clusterPad);
  const barGap = 3;
  const barW = Math.max(5, (innerClusterW - barGap * (B - 1)) / B);

  return (
    <section style={{ marginTop: 16, borderRadius: 14, border: "1px solid #e5e7eb", background: "white", padding: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>{title}</h2>
      {emptyHint ? <p style={{ marginTop: 6, fontSize: 13, color: "#92400e" }}>{emptyHint}</p> : null}
      {!hasDataPoint ? (
        <p style={{ marginTop: 8, fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
          За выбранные даты нет отметок по этим фильтрам — столбцы показывают пустые слоты (—).
        </p>
      ) : null}

      <div style={{ marginTop: 12, width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ height: "min(420px, 78vw)", width: "100%", minWidth: 480 }} preserveAspectRatio="xMidYMid meet">
          {gridYs.map((g) => (
            <g key={g}>
              <line x1={padL} y1={yAt(g)} x2={W - padR} y2={yAt(g)} stroke="#e5e7eb" strokeWidth={g === 0 || g === 100 ? 1.5 : 1} />
              <text x={10} y={yAt(g) + 4} fontSize={12} fill="#6b7280" fontWeight={700}>
                {g}%
              </text>
            </g>
          ))}

          {categories.map((_, k) => {
            const baseX = padL + k * catW + catW * clusterPad;
            const nodes: React.ReactNode[] = [];
            for (let b = 0; b < B; b++) {
              const v = values[k]?.[b];
              const pctVal = v === null || v === undefined ? null : Math.max(0, Math.min(100, v));
              const col = COLORS[b % COLORS.length];
              const x = baseX + b * (barW + barGap);
              const cx = x + barW / 2;

              if (pctVal === null) {
                nodes.push(
                  <rect
                    key={`${k}-${b}-empty`}
                    x={x}
                    y={baselineY - 3}
                    width={barW}
                    height={3}
                    fill="#e5e7eb"
                    stroke="#d1d5db"
                    strokeWidth={1}
                    rx={1}
                  />,
                );
                nodes.push(
                  <text key={`${k}-${b}-lbl`} x={cx} y={baselineY - 8} fontSize={10} fill="#9ca3af" fontWeight={700} textAnchor="middle">
                    —
                  </text>,
                );
              } else {
                const hRaw = innerH * (pctVal / 100);
                const h = pctVal <= 0 ? 3 : Math.max(hRaw, 3);
                const y = baselineY - h;
                nodes.push(<rect key={`${k}-${b}`} x={x} y={y} width={barW} height={h} fill={col} rx={2} />);
                const pctLabel =
                  pctVal === 0 ? "0 %" : Number.isInteger(pctVal) ? `${pctVal} %` : `${pctVal.toFixed(1)} %`;
                const ty = y < padT + 16 ? padT + 12 : y - 6;
                nodes.push(
                  <text key={`${k}-${b}-lbl`} x={cx} y={ty} fontSize={11} fill="#111827" fontWeight={800} textAnchor="middle">
                    {pctLabel}
                  </text>,
                );
              }
            }
            return <g key={`cat-${k}`}>{nodes}</g>;
          })}

          {categories.map((lab, k) => {
            const cx = padL + k * catW + catW / 2;
            const words = truncateLabel(lab, 52);
            return (
              <g key={`xl-${k}`}>
                <title>{lab}</title>
                <text
                  x={cx}
                  y={H - 68}
                  fontSize={10}
                  fill="#374151"
                  fontWeight={600}
                  textAnchor="middle"
                  transform={`rotate(-36 ${cx} ${H - 68})`}
                >
                  {words}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "right", whiteSpace: "nowrap" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 800 }}>Категория</th>
              {legendLabels.map((lab, b) => (
                <th key={b} style={{ padding: "10px 8px", color: COLORS[b % COLORS.length], fontWeight: 800 }}>{lab}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, k) => (
              <tr key={k} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 8px", textAlign: "left", fontWeight: 800, color: "#111827" }}>{cat}</td>
                {legendLabels.map((_, b) => {
                  const v = values[k]?.[b];
                  return (
                    <td key={b} style={{ padding: "8px 8px", color: "#374151" }}>
                      {v === null || v === undefined ? <span style={{ color: "#9ca3af" }}>—</span> : `${v}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 14,
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
        {legendLabels.map((lab, b) => (
          <span key={`${b}-${lab}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", height: 10, width: 14, borderRadius: 2, background: COLORS[b % COLORS.length] }} />
            {lab}
          </span>
        ))}
      </div>
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

function buildFacultyCourseHistograms(params: {
  facultyOptions: AcadepartmentFilterOption[];
  facSelected: Set<string>;
  fcCourses: Set<number>;
  weekly: AcadepartmentWeeklySeries[];
  weekKeys: string[];
  fromIso: string;
  toIso: string;
}): {
  byFaculty: { categories: string[]; legendLabels: string[]; values: (number | null)[][] };
  byCourse: { categories: string[]; legendLabels: string[]; values: (number | null)[][] };
} {
  const { facultyOptions, facSelected, fcCourses, weekly, weekKeys, fromIso, toIso } = params;
  const byId = weeklyById(weekly);
  const facultiesSorted = facultyOptions.filter((f) => facSelected.has(f.id)).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const coursesSorted = [...fcCourses].sort((a, b) => a - b);

  const seriesPct = (facultyId: string, course: number): number | null => {
    const sid = facultyId === "nofac" ? `nofac__c${course}` : `${facultyId}__c${course}`;
    const s = byId.get(sid);
    if (!s) return null;
    const { numer, denom } = aggregateWeeklyRange(s, weekKeys, fromIso, toIso);
    return pctAgg(numer, denom);
  };

  const categoriesF = facultiesSorted.map((f) => f.name);
  const legendCourses = coursesSorted.map((c) => `${c} курс`);
  const valuesByFaculty = facultiesSorted.map((f) => coursesSorted.map((c) => seriesPct(f.id, c)));

  const categoriesC = coursesSorted.map((c) => `${c} курс`);
  const legendFac = facultiesSorted.map((f) => f.name);
  const valuesByCourse = coursesSorted.map((c) => facultiesSorted.map((f) => seriesPct(f.id, c)));

  return {
    byFaculty: { categories: categoriesF, legendLabels: legendCourses, values: valuesByFaculty },
    byCourse: { categories: categoriesC, legendLabels: legendFac, values: valuesByCourse },
  };
}

function buildProgramCourseHistograms(params: {
  programOptions: AcadepartmentFilterOption[];
  progSelected: Set<string>;
  pcCourses: Set<number>;
  weekly: AcadepartmentWeeklySeries[];
  weekKeys: string[];
  fromIso: string;
  toIso: string;
}): {
  byProgram: { categories: string[]; legendLabels: string[]; values: (number | null)[][] };
  byCourse: { categories: string[]; legendLabels: string[]; values: (number | null)[][] };
} {
  const { programOptions, progSelected, pcCourses, weekly, weekKeys, fromIso, toIso } = params;
  const byId = weeklyById(weekly);
  const programsSorted = programOptions.filter((p) => progSelected.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const coursesSorted = [...pcCourses].sort((a, b) => a - b);

  const seriesPct = (programId: string, course: number): number | null => {
    const sid = `${programId}__c${course}`;
    const s = byId.get(sid);
    if (!s) return null;
    const { numer, denom } = aggregateWeeklyRange(s, weekKeys, fromIso, toIso);
    return pctAgg(numer, denom);
  };

  const categoriesP = programsSorted.map((p) => p.name);
  const legendCourses = coursesSorted.map((c) => `${c} курс`);
  const valuesByProgram = programsSorted.map((p) => coursesSorted.map((c) => seriesPct(p.id, c)));

  const categoriesC = coursesSorted.map((c) => `${c} курс`);
  const legendProg = programsSorted.map((p) => p.name);
  const valuesByCourse = coursesSorted.map((c) => programsSorted.map((p) => seriesPct(p.id, c)));

  return {
    byProgram: { categories: categoriesP, legendLabels: legendCourses, values: valuesByProgram },
    byCourse: { categories: categoriesC, legendLabels: legendProg, values: valuesByCourse },
  };
}

export function AcadepartmentChartsWithFilters(props: {
  weekKeys: string[];
  emptyHint: string | null;
  facultyCourseWeekly: AcadepartmentWeeklySeries[];
  programCourseWeekly: AcadepartmentWeeklySeries[];
  facultyOptions: AcadepartmentFilterOption[];
  programOptions: AcadepartmentFilterOption[];
  courseOptions: number[];
  semesterStartIso: string | null;
  semesterEndIso: string | null;
}) {
  const { facultyOptions, programOptions, courseOptions, weekKeys, semesterStartIso, semesterEndIso } = props;

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

  const [showFacultyBlock, setShowFacultyBlock] = React.useState(false);
  const [showProgramBlock, setShowProgramBlock] = React.useState(false);

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

  const fcWeeklyFiltered = React.useMemo(() => {
    return props.facultyCourseWeekly.filter((s) => {
      const p = parseSeriesKey(s.id);
      if (!p) return false;
      return facSelected.has(p.prefix) && fcCourses.has(p.course);
    });
  }, [props.facultyCourseWeekly, facSelected, fcCourses]);

  const pcWeeklyFiltered = React.useMemo(() => {
    return props.programCourseWeekly.filter((s) => {
      const p = parseSeriesKey(s.id);
      if (!p) return false;
      return progSelected.has(p.prefix) && pcCourses.has(p.course);
    });
  }, [props.programCourseWeekly, progSelected, pcCourses]);

  const facultyHist = React.useMemo(
    () =>
      buildFacultyCourseHistograms({
        facultyOptions,
        facSelected,
        fcCourses,
        weekly: fcWeeklyFiltered,
        weekKeys,
        fromIso: fcFrom,
        toIso: fcTo,
      }),
    [facultyOptions, facSelected, fcCourses, fcWeeklyFiltered, weekKeys, fcFrom, fcTo],
  );

  const programHist = React.useMemo(
    () =>
      buildProgramCourseHistograms({
        programOptions,
        progSelected,
        pcCourses,
        weekly: pcWeeklyFiltered,
        weekKeys,
        fromIso: pcFrom,
        toIso: pcTo,
      }),
    [programOptions, progSelected, pcCourses, pcWeeklyFiltered, weekKeys, pcFrom, pcTo],
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
    (weekKeys.length === 0 ? "Нет недельных данных за семестр для построения гистограмм." : null);

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
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>Факультеты и курсы</div>

        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
            Даты задают период агрегации (по неделям семестра); на оси X отображаются только факультеты или курсы.
          </p>

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
            <button type="button" style={primaryBuildStyle} onClick={() => setShowFacultyBlock(true)}>
              Построить
            </button>
          </div>

          {!showFacultyBlock ? (
            <p style={{ margin: 0, fontSize: 14, color: "#6b7280", fontWeight: 600 }}>
              Две гистограммы скрыты. Настройте фильтры и нажмите «Построить».
            </p>
          ) : (
            <>
              <ClusteredHistogram
                title="Посещаемость по факультетам (столбцы — курсы)"
                categories={facultyHist.byFaculty.categories}
                legendLabels={facultyHist.byFaculty.legendLabels}
                values={facultyHist.byFaculty.values}
                emptyHint={hint}
              />
              <ClusteredHistogram
                title="Посещаемость по курсам (столбцы — факультеты)"
                categories={facultyHist.byCourse.categories}
                legendLabels={facultyHist.byCourse.legendLabels}
                values={facultyHist.byCourse.values}
                emptyHint={hint}
              />
            </>
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
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>Направления и курсы</div>

        <div style={{ display: "grid", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
            Даты задают период агрегации; на оси X — направления или курсы.
          </p>

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
            <button type="button" style={primaryBuildStyle} onClick={() => setShowProgramBlock(true)}>
              Построить
            </button>
          </div>

          {!showProgramBlock ? (
            <p style={{ margin: 0, fontSize: 14, color: "#6b7280", fontWeight: 600 }}>
              Две гистограммы скрыты. Настройте фильтры и нажмите «Построить».
            </p>
          ) : (
            <>
              <ClusteredHistogram
                title="Посещаемость по направлениям (столбцы — курсы)"
                categories={programHist.byProgram.categories}
                legendLabels={programHist.byProgram.legendLabels}
                values={programHist.byProgram.values}
                emptyHint={hint}
              />
              <ClusteredHistogram
                title="Посещаемость по курсам (столбцы — направления)"
                categories={programHist.byCourse.categories}
                legendLabels={programHist.byCourse.legendLabels}
                values={programHist.byCourse.values}
                emptyHint={hint}
              />
            </>
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
