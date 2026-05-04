import Link from "next/link";

import { getCuratorGroupSummary } from "@/app/curator/dashboard/actions";

export default async function CuratorExemptionsPage() {
  const summary = await getCuratorGroupSummary();

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Освобождения</h1>
      </div>

      <p style={{ marginTop: 12, color: "#6b7280", fontWeight: 600 }}>
        Выберите группу, чтобы выставить статус А по занятиям за выбранную дату.
      </p>

      {!summary.ok ? (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "#fef2f2", color: "#991b1b", fontWeight: 800 }}>
          {summary.error}
        </div>
      ) : summary.rows.length === 0 ? (
        <p style={{ marginTop: 16, color: "#6b7280" }}>Нет групп, закреплённых за куратором.</p>
      ) : (
        <ul style={{ marginTop: 16, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
          {summary.rows.map((r) => (
            <li key={r.groupId}>
              <Link
                href={`/curator/exemptions/${r.groupId}`}
                style={{
                  display: "block",
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: "14px 16px",
                  background: "white",
                  fontWeight: 900,
                  color: "#111827",
                  textDecoration: "none",
                }}
              >
                {r.groupName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
