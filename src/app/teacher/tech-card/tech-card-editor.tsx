"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { saveTechCard } from "@/app/actions/tech-card-actions";
import { formatPoints, parsePoints, round2, validateTechCard, type CardLimits, type ModuleDraft } from "@/lib/points/calc";

type ModuleInit = {
  moduleNo: number;
  lessonsCount: number;
  attendancePoints: number;
  selfWorkPoints: number;
  currentControlPoints: number;
  borderControlPoints: number;
  lessons: number[];
};

type ModuleState = {
  lessonsCount: string;
  attendance: string;
  selfWork: string;
  current: string;
  border: string;
  lessons: string[];
};

const num = (s: string) => {
  const v = parsePoints(s);
  return v === null || Number.isNaN(v) ? 0 : v;
};

function splitEqually(pool: number, count: number): string[] {
  if (count <= 0) return [];
  const base = Math.floor((pool / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) => formatPoints(i === count - 1 ? round2(pool - base * (count - 1)) : base));
}

function toState(m: ModuleInit): ModuleState {
  return {
    lessonsCount: String(m.lessonsCount),
    attendance: formatPoints(m.attendancePoints),
    selfWork: formatPoints(m.selfWorkPoints),
    current: formatPoints(m.currentControlPoints),
    border: formatPoints(m.borderControlPoints),
    lessons: m.lessons.map(formatPoints),
  };
}

function toDraft(s: ModuleState): ModuleDraft {
  return {
    lessonsCount: Math.round(num(s.lessonsCount)),
    attendancePoints: num(s.attendance),
    selfWorkPoints: num(s.selfWork),
    currentControlPoints: num(s.current),
    borderControlPoints: num(s.border),
    lessons: s.lessons.map(num),
  };
}

const field: CSSProperties = {
  width: 84,
  height: 40,
  textAlign: "right",
  padding: "0 10px",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#d1d5db",
  fontWeight: 700,
  fontSize: 15,
  background: "white",
};

const card: CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "white", marginBottom: 12 };
const row: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0" };
const hint: CSSProperties = { fontSize: 12, color: "#6b7280" };

export function TechCardEditor(props: {
  cardId: string;
  title: string;
  subtitle: string;
  readOnly: boolean;
  limits: CardLimits;
  initial: { latePercent: number; extraMaxPoints: number; modules: ModuleInit[] };
}) {
  const { cardId, limits, readOnly } = props;
  const router = useRouter();
  const [late, setLate] = useState(formatPoints(props.initial.latePercent));
  const [extra, setExtra] = useState(formatPoints(props.initial.extraMaxPoints));
  const [mods, setMods] = useState<ModuleState[]>(props.initial.modules.map(toState));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  function patch(i: number, p: Partial<ModuleState>) {
    setError("");
    setOk("");
    setMods((prev) => prev.map((m, k) => (k === i ? { ...m, ...p } : m)));
  }

  function onCount(i: number, value: string) {
    if (!/^\d{0,2}$/.test(value)) return;
    const n = Math.min(60, Number(value || 0));
    patch(i, { lessonsCount: value, lessons: splitEqually(num(mods[i].current), n) });
  }

  function onCurrent(i: number, value: string) {
    if (value !== "" && !/^\d{0,3}([.,]\d{0,2})?$/.test(value)) return;
    patch(i, { current: value, lessons: splitEqually(num(value), Math.round(num(mods[i].lessonsCount))) });
  }

  function onNumber(i: number, key: "attendance" | "selfWork" | "border", value: string) {
    if (value !== "" && !/^\d{0,3}([.,]\d{0,2})?$/.test(value)) return;
    patch(i, { [key]: value } as Partial<ModuleState>);
  }

  function onLesson(i: number, k: number, value: string) {
    if (value !== "" && !/^\d{0,3}([.,]\d{0,2})?$/.test(value)) return;
    patch(i, { lessons: mods[i].lessons.map((v, j) => (j === k ? value : v)) });
  }

  const drafts = mods.map(toDraft);
  const validation = validateTechCard({ latePercent: num(late), extraMaxPoints: num(extra), modules: drafts }, limits);

  async function onSave() {
    setError("");
    setOk("");
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    const res = await saveTechCard({
      techCardId: cardId,
      latePercent: num(late),
      extraMaxPoints: num(extra),
      modules: drafts.map((d, i) => ({ ...d, moduleNo: i + 1 })),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOk("Технологическая карта сохранена");
    router.refresh();
  }

  const moduleTotals = drafts.map((d) => d.attendancePoints + d.selfWorkPoints + d.currentControlPoints + d.borderControlPoints);
  const semesterSum = moduleTotals.reduce((a, b) => a + b, 0);

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Технологическая карта</h1>
      <div style={{ fontWeight: 800, marginTop: 2 }}>{props.title}</div>
      <div style={{ ...hint, marginBottom: 12 }}>{props.subtitle}</div>

      <div style={{ ...card, background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e3a8a", fontSize: 14 }}>
        В семестре {formatPoints(limits.totalPoints)} баллов, в каждом модуле {formatPoints(limits.modulePoints)}. Эти лимиты задаёт учебная часть. Вы
        делите баллы модуля на категории. Дополнительные баллы (до {formatPoints(limits.extraMaxPoints)}) добавляются после двух модулей, итог не больше{" "}
        {formatPoints(limits.totalPoints)}.
      </div>

      {mods.map((m, i) => {
        const total = moduleTotals[i];
        const lessonsSum = drafts[i].lessons.reduce((a, b) => a + b, 0);
        const pool = drafts[i].currentControlPoints;
        const over = total > limits.modulePoints + 1e-9;
        const under = total < limits.modulePoints - 1e-9;
        const tone = over ? "#b91c1c" : under ? "#b45309" : "#166534";
        const perLesson = drafts[i].lessonsCount > 0 ? drafts[i].attendancePoints / drafts[i].lessonsCount : 0;
        const lessonsTone = lessonsSum > pool + 1e-9 ? "#b91c1c" : lessonsSum < pool - 1e-9 ? "#b45309" : "#166534";
        return (
          <section key={i} style={card}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Модуль {i + 1}</div>

            <div style={row}>
              <div>
                <div>Занятий в модуле</div>
                <div style={hint}>по ним делятся баллы</div>
              </div>
              <input style={field} inputMode="numeric" value={m.lessonsCount} disabled={readOnly} onChange={(e) => onCount(i, e.target.value)} aria-label={`Модуль ${i + 1}: занятий`} />
            </div>

            <div style={row}>
              <div>
                <div>Посещаемость</div>
                <div style={hint}>
                  необязательно · за занятие {formatPoints(perLesson)}
                </div>
              </div>
              <input style={field} inputMode="decimal" value={m.attendance} disabled={readOnly} onChange={(e) => onNumber(i, "attendance", e.target.value)} aria-label={`Модуль ${i + 1}: посещаемость`} />
            </div>

            <div style={row}>
              <div>
                <div>Самостоятельная работа</div>
                <div style={hint}>обязательно</div>
              </div>
              <input style={field} inputMode="decimal" value={m.selfWork} disabled={readOnly} onChange={(e) => onNumber(i, "selfWork", e.target.value)} aria-label={`Модуль ${i + 1}: самостоятельная работа`} />
            </div>

            <div style={row}>
              <div>
                <div>Рубежный контроль</div>
                <div style={hint}>обязательно</div>
              </div>
              <input style={field} inputMode="decimal" value={m.border} disabled={readOnly} onChange={(e) => onNumber(i, "border", e.target.value)} aria-label={`Модуль ${i + 1}: рубежный контроль`} />
            </div>

            <div style={row}>
              <div>
                <div>Текущий контроль</div>
                <div style={hint}>обязательно · делится по занятиям</div>
              </div>
              <input style={field} inputMode="decimal" value={m.current} disabled={readOnly} onChange={(e) => onCurrent(i, e.target.value)} aria-label={`Модуль ${i + 1}: текущий контроль`} />
            </div>

            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 8 }}>
              <div style={{ ...row, padding: "0 0 6px" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Баллы по занятиям</div>
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() => patch(i, { lessons: splitEqually(pool, drafts[i].lessonsCount) })}
                    style={{ height: 34, borderRadius: 10, border: "1px solid #d1d5db", background: "white", padding: "0 10px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Разделить поровну
                  </button>
                ) : null}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 8 }}>
                {m.lessons.map((v, k) => (
                  <label key={k} style={{ display: "grid", gap: 2, fontSize: 11, color: "#6b7280", textAlign: "center" }}>
                    {k + 1}
                    <input
                      inputMode="decimal"
                      value={v}
                      disabled={readOnly}
                      onChange={(e) => onLesson(i, k, e.target.value)}
                      aria-label={`Модуль ${i + 1}, занятие ${k + 1}`}
                      style={{ ...field, width: "100%", padding: "0 6px", textAlign: "right" }}
                    />
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 13, marginTop: 6, color: lessonsTone, fontWeight: 700 }}>
                По занятиям: {formatPoints(lessonsSum)} из {formatPoints(pool)}
                {lessonsSum > pool + 1e-9 ? " — превышение" : lessonsSum < pool - 1e-9 ? " — не распределено" : ""}
              </div>
              <div style={hint}>Больше, чем указано здесь, за занятие поставить нельзя.</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: tone }}>
                <span>
                  Распределено {formatPoints(total)} из {formatPoints(limits.modulePoints)}
                </span>
                <span>{over ? `превышение на ${formatPoints(total - limits.modulePoints)}` : under ? `не распределено ${formatPoints(limits.modulePoints - total)}` : "всё распределено"}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6", marginTop: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (total / limits.modulePoints) * 100)}%`, background: tone }} />
              </div>
            </div>
          </section>
        );
      })}

      <section style={card}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Для всего семестра</div>
        <div style={row}>
          <div>
            <div>Дополнительные баллы</div>
            <div style={hint}>после двух модулей, до {formatPoints(limits.extraMaxPoints)}</div>
          </div>
          <input
            style={field}
            inputMode="decimal"
            value={extra}
            disabled={readOnly}
            onChange={(e) => {
              if (e.target.value !== "" && !/^\d{0,3}([.,]\d{0,2})?$/.test(e.target.value)) return;
              setExtra(e.target.value);
              setError("");
              setOk("");
            }}
            aria-label="Дополнительные баллы"
          />
        </div>
        <div style={row}>
          <div>
            <div>Опоздание (О) даёт</div>
            <div style={hint}>% баллов за посещение</div>
          </div>
          <input
            style={field}
            inputMode="decimal"
            value={late}
            disabled={readOnly}
            onChange={(e) => {
              if (e.target.value !== "" && !/^\d{0,3}([.,]\d{0,2})?$/.test(e.target.value)) return;
              setLate(e.target.value);
              setError("");
              setOk("");
            }}
            aria-label="Процент за опоздание"
          />
        </div>
        <div style={hint}>
          Два модуля: {formatPoints(semesterSum)} из {formatPoints(limits.totalPoints)}. Итог студента не превысит {formatPoints(limits.totalPoints)}.
        </div>
      </section>

      {error ? (
        <div style={{ ...card, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b", fontWeight: 700, fontSize: 14 }}>{error}</div>
      ) : null}
      {ok ? <div style={{ ...card, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534", fontWeight: 700, fontSize: 14 }}>{ok}</div> : null}
      {!error && !ok && validation ? <div style={{ fontSize: 13, color: "#92400e", marginBottom: 10 }}>{validation}</div> : null}

      {!readOnly ? (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{ width: "100%", height: 48, borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 800, fontSize: 16, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Сохранение..." : "Сохранить карту"}
        </button>
      ) : (
        <div style={hint}>Карту нельзя изменить: семестр закрыт.</div>
      )}
    </>
  );
}
