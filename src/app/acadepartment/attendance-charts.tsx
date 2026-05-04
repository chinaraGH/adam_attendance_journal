"use client";

import * as React from "react";

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
        <p className="mt-3 text-sm text-gray-600">Нет рядов для отображения.</p>
      )}
    </section>
  );
}

export function AttendanceDynamicsCharts(props: {
  weekLabels: string[];
  facultyCourse: Series[];
  byProgram: Series[];
  emptyHint: string | null;
}) {
  return (
    <div className="grid gap-8">
      <LineChartBlock
        title="Динамика посещаемости по факультетам и курсам"
        weekLabels={props.weekLabels}
        series={props.facultyCourse}
        emptyHint={props.emptyHint}
      />
      <LineChartBlock
        title="Динамика посещаемости по направлениям подготовки (программам)"
        weekLabels={props.weekLabels}
        series={props.byProgram}
        emptyHint={props.emptyHint}
      />
    </div>
  );
}
