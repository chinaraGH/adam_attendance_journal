import type { CSSProperties } from "react";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrRedirect } from "@/lib/auth/get-current-user";
import type { AttendanceStatusV2 } from "@/lib/attendance/status-machine";
import { normalizeAttendanceStatusV2 } from "@/lib/attendance/status-machine";

import { ProblemGroupsClient } from "./problem-groups-client";

export const dynamic = "force-dynamic";

type StatusAgg = { P: number; O: number; NB: number; B: number; A: number; S: number; OTHER: number };

function emptyAgg(): StatusAgg {
  return { P: 0, O: 0, NB: 0, B: 0, A: 0, S: 0, OTHER: 0 };
}

function addToAgg(agg: StatusAgg, statusV2: string | null, n: number) {
  const c = normalizeAttendanceStatusV2(statusV2);
  if (!c) {
    agg.OTHER += n;
    return;
  }
  const canon = c as AttendanceStatusV2;
  if (canon === "P") agg.P += n;
  else if (canon === "O") agg.O += n;
  else if (canon === "NB") agg.NB += n;
  else if (canon === "B_PENDING" || canon === "B_CONFIRMED") agg.B += n;
  else if (canon === "A") agg.A += n;
  else if (canon === "S") agg.S += n;
  else agg.OTHER += n;
}

type DiscRow = {
  disciplineId: string;
  name: string;
  attendancePct: number;
  totalMarks: number;
  marksP: number;
  marksO: number;
  marksNb: number;
  marksB: number;
  marksA: number;
  marksS: number;
  marksOther: number;
};

const th: CSSProperties = {
  padding: "10px 8px",
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const td: CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #f3f4f6",
  fontSize: 14,
};

function pctCell(p: number) {
  return `${p} %`;
}

function DisciplineTable(props: { title: string; rows: DiscRow[]; empty: string }) {
  if (props.rows.length === 0) {
    return (
      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 10 }}>{props.title}</div>
        <div style={{ fontSize: 14, color: "#6b7280", fontWeight: 600 }}>{props.empty}</div>
      </div>
    );
  }
  return (
    <div
      style={{
        marginTop: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
        background: "white",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 12 }}>{props.title}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Дисциплина</th>
              <th style={th}>% (П+О)</th>
              <th style={th}>П</th>
              <th style={th}>О</th>
              <th style={th}>НБ</th>
              <th style={th}>Б</th>
              <th style={th}>А</th>
              <th style={th}>С</th>
              <th style={th}>Пр.</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((d, idx) => (
              <tr key={d.disciplineId}>
                <td style={{ ...td, fontWeight: 900 }}>{idx + 1}</td>
                <td style={{ ...td, fontWeight: 900 }}>{d.name}</td>
                <td style={{ ...td, fontWeight: 900 }}>{pctCell(d.attendancePct)}</td>
                <td style={td}>{d.marksP}</td>
                <td style={td}>{d.marksO}</td>
                <td style={td}>{d.marksNb}</td>
                <td style={td}>{d.marksB}</td>
                <td style={td}>{d.marksA}</td>
                <td style={td}>{d.marksS}</td>
                <td style={td}>{d.marksOther}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function LeadershipPage() {
  const actor = await getCurrentUserOrRedirect();
  if (actor.role !== "LEADERSHIP") {
    return (
      <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Руководство</h1>
        <p style={{ marginTop: 12, fontSize: 14, color: "#6b7280", fontWeight: 600 }}>Недостаточно прав.</p>
      </main>
    );
  }

  const bySessionSt = await prisma.attendance.groupBy({
    by: ["classSessionId", "statusV2"],
    where: { isActive: true, deletedAt: null, statusV2: { not: null } },
    _count: { _all: true },
  });

  const sessionIds = [...new Set(bySessionSt.map((x) => x.classSessionId))];
  const sessions =
    sessionIds.length === 0
      ? []
      : await prisma.classSession.findMany({
          where: { id: { in: sessionIds }, isActive: true, deletedAt: null },
          select: { id: true, disciplineId: true, discipline: { select: { name: true } } },
        });

  const sessionToDiscipline = new Map(sessions.map((s) => [s.id, s.disciplineId]));
  const disciplineName = new Map(sessions.map((s) => [s.disciplineId, s.discipline?.name ?? s.disciplineId]));

  const marksByDiscipline = new Map<string, StatusAgg>();
  const denomByDiscipline = new Map<string, number>();

  for (const row of bySessionSt) {
    const did = sessionToDiscipline.get(row.classSessionId);
    if (!did) continue;
    const n = row._count._all;
    denomByDiscipline.set(did, (denomByDiscipline.get(did) ?? 0) + n);
    const agg = marksByDiscipline.get(did) ?? emptyAgg();
    addToAgg(agg, row.statusV2, n);
    marksByDiscipline.set(did, agg);
  }

  const disciplineRowsFull: DiscRow[] = [...denomByDiscipline.keys()].map((disciplineId) => {
    const denom = denomByDiscipline.get(disciplineId) ?? 0;
    const m = marksByDiscipline.get(disciplineId) ?? emptyAgg();
    const numer = m.P + m.O;
    const pct = denom > 0 ? Math.round((numer / denom) * 1000) / 10 : 0;
    return {
      disciplineId,
      name: disciplineName.get(disciplineId) ?? disciplineId,
      attendancePct: pct,
      totalMarks: denom,
      marksP: m.P,
      marksO: m.O,
      marksNb: m.NB,
      marksB: m.B,
      marksA: m.A,
      marksS: m.S,
      marksOther: m.OTHER,
    };
  });

  const disciplineWorst = [...disciplineRowsFull].filter((r) => r.totalMarks > 0).sort((a, b) => a.attendancePct - b.attendancePct).slice(0, 10);

  const disciplineBest = [...disciplineRowsFull].filter((r) => r.totalMarks > 0).sort((a, b) => b.attendancePct - a.attendancePct).slice(0, 10);

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <ProblemGroupsClient />

      <DisciplineTable title="Посещаемость по дисциплинам (ТОП-10 худших)" rows={disciplineWorst} empty="Нет данных." />

      <DisciplineTable title="Посещаемость по дисциплинам (ТОП-10 лучших)" rows={disciplineBest} empty="Нет данных." />
    </main>
  );
}
