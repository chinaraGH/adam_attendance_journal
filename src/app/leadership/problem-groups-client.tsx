"use client";

import * as React from "react";

import { ExportCsvButton } from "@/components/export-csv-button";

const cardStyle: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 16,
  background: "white",
};

const th: React.CSSProperties = {
  padding: "10px 8px",
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const td: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #f3f4f6",
  fontSize: 14,
};

export type GroupRowApi = {
  groupId: string;
  name: string;
  code: string | null;
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

type ApiResponse =
  | { ok: true; threshold: number; problemGroups: GroupRowApi[]; topGroups: GroupRowApi[]; worstGroups: GroupRowApi[] }
  | { ok: false; error: string };

function pctCell(p: number) {
  return `${p} %`;
}

function GroupMarksTable(props: { title: string; rows: GroupRowApi[]; empty: string }) {
  if (props.rows.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>{props.title}</div>
        <div style={{ fontSize: 14, color: "#6b7280", fontWeight: 600 }}>{props.empty}</div>
      </div>
    );
  }
  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 900, marginBottom: 12 }}>{props.title}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Группа</th>
              <th style={th}>% посещаемости</th>
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
            {props.rows.map((g, idx) => (
              <tr key={g.groupId}>
                <td style={{ ...td, fontWeight: 900 }}>{idx + 1}</td>
                <td style={{ ...td, fontWeight: 900 }}>{g.name}</td>
                <td style={{ ...td, fontWeight: 900 }}>{pctCell(g.attendancePct)}</td>
                <td style={td}>{g.marksP}</td>
                <td style={td}>{g.marksO}</td>
                <td style={td}>{g.marksNb}</td>
                <td style={td}>{g.marksB}</td>
                <td style={td}>{g.marksA}</td>
                <td style={td}>{g.marksS}</td>
                <td style={td}>{g.marksOther}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProblemGroupsClient() {
  const [data, setData] = React.useState<ApiResponse | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/problem-groups", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json as ApiResponse);
      })
      .catch((e) => {
        if (!cancelled) setData({ ok: false, error: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const problem = data && data.ok ? data.problemGroups : [];
  const top = data && data.ok ? data.topGroups : [];
  const worst = data && data.ok ? data.worstGroups : [];

  const csvRows =
    data && data.ok
      ? [
          ...problem.map((g) => ({
            type: "problem",
            groupId: g.groupId,
            name: g.name,
            code: g.code,
            attendancePct: g.attendancePct,
            totalMarks: g.totalMarks,
            П: g.marksP,
            О: g.marksO,
            НБ: g.marksNb,
            Б: g.marksB,
            А: g.marksA,
            С: g.marksS,
            Прочие: g.marksOther,
          })),
          ...top.map((g) => ({
            type: "top5",
            groupId: g.groupId,
            name: g.name,
            code: g.code,
            attendancePct: g.attendancePct,
            totalMarks: g.totalMarks,
            П: g.marksP,
            О: g.marksO,
            НБ: g.marksNb,
            Б: g.marksB,
            А: g.marksA,
            С: g.marksS,
            Прочие: g.marksOther,
          })),
          ...worst.map((g) => ({
            type: "worst5",
            groupId: g.groupId,
            name: g.name,
            code: g.code,
            attendancePct: g.attendancePct,
            totalMarks: g.totalMarks,
            П: g.marksP,
            О: g.marksO,
            НБ: g.marksNb,
            Б: g.marksB,
            А: g.marksA,
            С: g.marksS,
            Прочие: g.marksOther,
          })),
        ]
      : [];

  return (
    <div style={{ display: "grid", gap: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: "#111827" }}>Руководство</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#6b7280", fontWeight: 600 }}>
            Проблемные группы: посещаемость ниже {data && data.ok ? data.threshold : 70}%
          </p>
        </div>
        <ExportCsvButton
          filename="leadership-dashboard.csv"
          rows={csvRows}
          label="Скачать Excel (официальная ведомость)"
        />
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 900, marginBottom: 12 }}>Проблемные группы</div>
        {!data ? (
          <div style={{ fontSize: 14, color: "#6b7280" }}>Загрузка...</div>
        ) : !data.ok ? (
          <div style={{ fontSize: 14, fontWeight: 800, color: "#b91c1c" }}>{data.error}</div>
        ) : problem.length === 0 ? (
          <div style={{ fontSize: 14, color: "#6b7280" }}>Нет проблемных групп.</div>
        ) : (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {problem.map((g) => (
              <div
                key={g.groupId}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 14,
                  background: "#fafafa",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 15 }}>{g.name}</div>
                <div style={{ marginTop: 6, fontSize: 14, color: "#6b7280", fontWeight: 600 }}>
                  {g.code ?? g.name} - {pctCell(g.attendancePct)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!data ? (
        <div style={{ ...cardStyle, marginTop: 16, color: "#6b7280", fontWeight: 600 }}>Загрузка таблиц групп…</div>
      ) : !data.ok ? null : (
        <>
          <GroupMarksTable title="ТОП-5 групп по посещаемости" rows={top} empty="Нет данных." />
          <GroupMarksTable title="ТОП-5 худших групп по посещаемости" rows={worst} empty="Нет данных." />
        </>
      )}
    </div>
  );
}
