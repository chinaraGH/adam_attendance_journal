"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { saveControlScores } from "@/app/actions/control-score-actions";
import { formatPoints, parsePoints } from "@/lib/points/calc";

type Option = {
  cardId: string;
  label: string;
  groups: { id: string; name: string }[];
  categories: { key: string; label: string; max: number; closed: boolean }[];
};

const select: CSSProperties = { width: "100%", height: 42, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 15, background: "white" };
const box = (tone: "error" | "ok" | "info"): CSSProperties => ({
  marginBottom: 12, borderWidth: 1, borderStyle: "solid", borderRadius: 12, padding: "10px 12px", fontSize: 14,
  ...(tone === "error" ? { borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 } : tone === "ok" ? { borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534", fontWeight: 700 } : { borderColor: "#bfdbfe", background: "#eff6ff", color: "#1e3a8a" }),
});

export function ControlClient(props: {
  options: Option[];
  selected: { cardId: string; groupId: string; cat: string };
  category: "SELF_WORK" | "BORDER_CONTROL" | "EXTRA";
  moduleNo: number;
  max: number;
  closed: boolean;
  students: { id: string; name: string }[];
  initial: Record<string, number>;
}) {
  const { options, selected, students, max, closed, category } = props;
  const router = useRouter();
  const opt = options.find((o) => o.cardId === selected.cardId)!;
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [s.id, props.initial[s.id] === undefined ? "" : formatPoints(props.initial[s.id])])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const go = (cardId: string, groupId?: string, cat?: string) => {
    const o = options.find((x) => x.cardId === cardId)!;
    const g = groupId ?? o.groups[0].id;
    const c = cat ?? o.categories[0].key;
    router.push(`/teacher/control?cardId=${encodeURIComponent(cardId)}&groupId=${encodeURIComponent(g)}&cat=${encodeURIComponent(c)}`);
  };

  const strict = category !== "EXTRA";
  const filled = students.filter((s) => values[s.id].trim() !== "").length;
  const editable = !closed && max > 0;

  async function onSave() {
    setError("");
    setOk("");
    const items: Array<{ studentId: string; score: number }> = [];
    const empty: string[] = [];
    for (const s of students) {
      const v = parsePoints(values[s.id]);
      if (v === null) {
        if (strict) empty.push(s.name);
        continue;
      }
      if (Number.isNaN(v) || v < 0 || v > max + 1e-9) {
        setError(`Оценка должна быть от 0 до ${formatPoints(max)}: ${s.name}.`);
        return;
      }
      items.push({ studentId: s.id, score: v });
    }
    if (empty.length > 0) {
      setError(`Не заполнено: ${empty.join(", ")}.`);
      return;
    }
    setSaving(true);
    const res = await saveControlScores({ techCardId: selected.cardId, groupId: selected.groupId, category, moduleNo: props.moduleNo, items });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOk("Оценки сохранены");
    router.refresh();
  }

  return (
    <>
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <select style={select} value={selected.cardId} onChange={(e) => go(e.target.value)} aria-label="Дисциплина">
          {options.map((o) => (
            <option key={o.cardId} value={o.cardId}>{o.label}</option>
          ))}
        </select>
        <select style={select} value={selected.groupId} onChange={(e) => go(selected.cardId, e.target.value, selected.cat)} aria-label="Группа">
          {opt.groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select style={select} value={selected.cat} onChange={(e) => go(selected.cardId, selected.groupId, e.target.value)} aria-label="Категория">
          {opt.categories.map((c) => (
            <option key={c.key} value={c.key}>{c.label} (до {formatPoints(c.max)})</option>
          ))}
        </select>
      </div>

      {closed ? <div style={box("info")}>Модуль закрыт учебной частью: оценки больше не меняются.</div> : null}
      {!closed && max <= 0 ? <div style={box("info")}>В технологической карте для этой категории не заданы баллы.</div> : null}
      {category === "EXTRA" ? <div style={box("info")}>Дополнительные баллы добавляются после модулей. Итог студента не может быть больше лимита семестра.</div> : null}
      {error ? <div style={box("error")}>{error}</div> : null}
      {ok ? <div style={box("ok")}>{ok}</div> : null}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {students.map((s, i) => (
          <li key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", background: "white" }}>
            <span style={{ fontWeight: 700 }}>{i + 1}. {s.name}</span>
            <input
              inputMode="decimal"
              value={values[s.id]}
              placeholder={`из ${formatPoints(max)}`}
              disabled={!editable || saving}
              aria-label={`Оценка: ${s.name}`}
              onChange={(e) => {
                const v = e.target.value;
                if (v !== "" && !/^\d{0,3}([.,]\d{0,2})?$/.test(v)) return;
                setError(""); setOk("");
                setValues((p) => ({ ...p, [s.id]: v }));
              }}
              onBlur={() => {
                const v = parsePoints(values[s.id]);
                if (v !== null && !Number.isNaN(v)) setValues((p) => ({ ...p, [s.id]: formatPoints(v) }));
              }}
              style={{ width: 90, height: 40, textAlign: "right", padding: "0 10px", borderRadius: 10, border: "1px solid #93c5fd", fontWeight: 700, fontSize: 15, background: editable ? "white" : "#f3f4f6" }}
            />
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center" }}>
        <button type="button" onClick={onSave} disabled={!editable || saving} style={{ borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", padding: "12px 18px", fontWeight: 800, fontSize: 15, opacity: !editable || saving ? 0.6 : 1, cursor: !editable || saving ? "not-allowed" : "pointer" }}>
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
        <span style={{ color: "#374151", fontWeight: 600, fontSize: 14 }}>Заполнено {filled} из {students.length}</span>
      </div>
    </>
  );
}
