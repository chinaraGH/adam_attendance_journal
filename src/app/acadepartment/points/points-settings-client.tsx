"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { saveSemesterLimits, setModuleClosed } from "@/app/actions/semester-points-actions";
import { formatPoints, parsePoints } from "@/lib/points/calc";

const card: CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "white", marginBottom: 12 };
const input: CSSProperties = { width: 96, height: 44, boxSizing: "border-box", textAlign: "right", padding: "0 12px", borderRadius: 12, border: "1px solid #d1d5db", fontWeight: 700, fontSize: 15 };
const row: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0" };

export function PointsSettingsClient(props: {
  semesterId: string;
  name: string;
  totalPoints: number;
  modulePoints: number;
  extraMaxPoints: number;
  module1Closed: boolean;
  module2Closed: boolean;
}) {
  const router = useRouter();
  const [total, setTotal] = useState(formatPoints(props.totalPoints));
  const [mod, setMod] = useState(formatPoints(props.modulePoints));
  const [extra, setExtra] = useState(formatPoints(props.extraMaxPoints));
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const num = (s: string) => {
    const v = parsePoints(s);
    return v === null || Number.isNaN(v) ? NaN : v;
  };

  async function saveLimits() {
    setBusy(true);
    setMsg(null);
    const res = await saveSemesterLimits({ semesterId: props.semesterId, totalPoints: num(total), modulePoints: num(mod), extraMaxPoints: num(extra) });
    setBusy(false);
    setMsg(res.ok ? { tone: "ok", text: "Лимиты сохранены" } : { tone: "error", text: res.error });
    if (res.ok) router.refresh();
  }

  async function toggle(moduleNo: number, closed: boolean) {
    if (closed && !window.confirm(`Закрыть модуль ${moduleNo}? Преподаватели больше не смогут менять оценки этого модуля.`)) return;
    setBusy(true);
    setMsg(null);
    const res = await setModuleClosed({ semesterId: props.semesterId, moduleNo, closed });
    setBusy(false);
    setMsg(res.ok ? { tone: "ok", text: closed ? `Модуль ${moduleNo} закрыт` : `Модуль ${moduleNo} снова открыт` } : { tone: "error", text: res.error });
    if (res.ok) router.refresh();
  }

  const closedBtn = (n: number, closed: boolean) => (
    <div style={row}>
      <div>
        <div style={{ fontWeight: 700 }}>Модуль {n}</div>
        <div style={{ fontSize: 12, color: closed ? "#991b1b" : "#374151", fontWeight: 700 }}>{closed ? "закрыт, оценки не меняются" : "открыт"}</div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => toggle(n, !closed)}
        style={{ height: 44, minWidth: 160, boxSizing: "border-box", borderRadius: 12, padding: "0 14px", fontSize: 14, fontWeight: 800, cursor: busy ? "wait" : "pointer", border: "1px solid " + (closed ? "#d1d5db" : "#991b1b"), background: closed ? "white" : "#991b1b", color: closed ? "#111827" : "white" }}
      >
        {closed ? "Открыть снова" : "Закрыть модуль"}
      </button>
    </div>
  );

  return (
    <section style={card}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{props.name}</div>
      <div style={row}><span>Баллов за семестр</span><input style={input} inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} aria-label="Баллов за семестр" /></div>
      <div style={row}><span>Баллов за модуль</span><input style={input} inputMode="decimal" value={mod} onChange={(e) => setMod(e.target.value)} aria-label="Баллов за модуль" /></div>
      <div style={row}><span>Дополнительных, до</span><input style={input} inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} aria-label="Дополнительные баллы" /></div>
      <button type="button" disabled={busy} onClick={saveLimits} style={{ width: "100%", height: 44, boxSizing: "border-box", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontSize: 14, fontWeight: 800, marginTop: 6, cursor: busy ? "wait" : "pointer" }}>
        Сохранить лимиты
      </button>
      <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 12, paddingTop: 4 }}>
        {closedBtn(1, props.module1Closed)}
        {closedBtn(2, props.module2Closed)}
      </div>
      {msg ? (
        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: msg.tone === "ok" ? "#111827" : "#991b1b" }}>{msg.text}</div>
      ) : null}
    </section>
  );
}
