"use client";

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { saveAttendances } from "./actions";
import { saveLessonScores } from "@/app/actions/lesson-score-actions";
import { BackToolbar, ExitButton } from "@/components/exit-button";
import { attendancePointsForLesson, formatPoints, parsePoints } from "@/lib/points/calc";

type Student = { id: string; name: string };

/** Что экрану нужно знать о технологической карте (только простые данные). */
export type ClientPlan =
  | {
      available: true;
      moduleNo: number;
      lessonNo: number;
      moduleLessons: number;
      lessonMax: number;
      remainingAfter: number;
      attendancePerLesson: number;
      latePercent: number;
      moduleClosed: boolean;
      scores: Record<string, number>;
    }
  | { available: false; code: string; reason: string; disciplineId?: string; programId?: string; semesterId?: string };

const STATUS = { P: "P", O: "O", NB: "NB", B: "B", A: "A" } as const;
type Status = (typeof STATUS)[keyof typeof STATUS];
const ORDER: Status[] = ["P", "O", "NB", "B", "A"];
const LABEL: Record<Status, string> = { P: "П", O: "О", NB: "НБ", B: "Б", A: "А" };

function normalizeStatus(input: unknown): Status | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toUpperCase();
  if (s === "A") return "A";
  if (s === "B" || s === "B_PENDING" || s === "B_CONFIRMED") return "B";
  if (s === "P" || s === "O" || s === "NB") return s;
  return null; // «S» (закрыто автоматически) и пустое считаются неотмеченными
}

const COLORS: Record<Status, { bg: string; fg: string; border: string }> = {
  P: { bg: "#16a34a", fg: "#ffffff", border: "#16a34a" },
  O: { bg: "#f59e0b", fg: "#111827", border: "#f59e0b" },
  NB: { bg: "#dc2626", fg: "#ffffff", border: "#dc2626" },
  B: { bg: "#2563eb", fg: "#ffffff", border: "#2563eb" },
  A: { bg: "#15803d", fg: "#ffffff", border: "#15803d" },
};

function statusButtonStyle(kind: Status, active: boolean, disabled: boolean): CSSProperties {
  const c = COLORS[kind];
  return {
    flex: 1,
    minWidth: 0,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: active ? c.border : "#d1d5db",
    background: active ? c.bg : "white",
    color: active ? c.fg : "#374151",
    fontWeight: 700,
    fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled && !active ? 0.45 : 1,
  };
}

const box = (tone: "info" | "error" | "ok"): CSSProperties => ({
  marginBottom: 12,
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  ...(tone === "error"
    ? { borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 }
    : tone === "ok"
      ? { borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534", fontWeight: 700 }
      : { borderColor: "#bfdbfe", background: "#eff6ff", color: "#1e3a8a" }),
});

export function AttendanceClient(props: {
  students: Student[];
  initialStatusByStudentId: Record<string, string | null | undefined>;
  classSessionId: string;
  /** Можно ли ещё менять посещаемость (идёт занятие или прошло не больше 10 минут). */
  attendanceEditable: boolean;
  /** Можно ли менять оценки (закрыт ли семестр, отменено ли занятие). */
  scoresEditable: boolean;
  plan: ClientPlan;
  header?: ReactNode;
}) {
  const { students, classSessionId, attendanceEditable, scoresEditable, plan, header } = props;
  const router = useRouter();

  const confirmedB = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) if (String(props.initialStatusByStudentId[s.id] ?? "").toUpperCase() === "B_CONFIRMED") set.add(s.id);
    return set;
  }, [students, props.initialStatusByStudentId]);

  const initialStatuses = useMemo(() => {
    const m: Record<string, Status | null> = {};
    for (const s of students) m[s.id] = normalizeStatus(props.initialStatusByStudentId[s.id]);
    return m;
  }, [students, props.initialStatusByStudentId]);

  const [statusById, setStatusById] = useState<Record<string, Status | null>>(initialStatuses);
  const initialScores = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of students) {
      const v = plan.available ? plan.scores[s.id] : undefined;
      m[s.id] = v === undefined ? "" : formatPoints(v);
    }
    return m;
  }, [students, plan]);
  const [scoreById, setScoreById] = useState<Record<string, string>>(initialScores);
  const initialRef = useRef({ statuses: initialStatuses, scores: initialScores });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [okMessage, setOkMessage] = useState("");

  const scoring = plan.available && scoresEditable && !plan.moduleClosed;
  const lessonMax = plan.available ? plan.lessonMax : 0;

  const unmarked = students.filter((s) => !statusById[s.id]).length;
  const needScore = (id: string) => statusById[id] === "P" || statusById[id] === "O";
  const missingScores = scoring ? students.filter((s) => needScore(s.id) && scoreById[s.id].trim() === "").length : 0;

  const isDirty = useMemo(() => {
    for (const s of students) {
      if ((statusById[s.id] ?? null) !== (initialRef.current.statuses[s.id] ?? null)) return true;
      if ((scoreById[s.id] ?? "") !== (initialRef.current.scores[s.id] ?? "")) return true;
    }
    return false;
  }, [statusById, scoreById, students]);

  function setStatus(id: string, status: Status) {
    setErrorMessage("");
    setOkMessage("");
    if (!attendanceEditable || isSaving) return;
    if (initialStatuses[id] === "A" || confirmedB.has(id) || status === "A") return; // «А» и подтверждённую «Б» ставит только администрация
    setStatusById((prev) => ({ ...prev, [id]: status }));
  }

  function setScore(id: string, value: string) {
    setErrorMessage("");
    setOkMessage("");
    if (!scoring || isSaving) return;
    if (value !== "" && !/^\d{0,3}([.,]\d{0,2})?$/.test(value)) return;
    setScoreById((prev) => ({ ...prev, [id]: value }));
  }

  const canSave = (attendanceEditable || scoring) && !isSaving;

  function onSave() {
    setErrorMessage("");
    setOkMessage("");

    if (attendanceEditable && unmarked > 0) {
      setErrorMessage(`Отметьте всех студентов: осталось ${unmarked}.`);
      return;
    }
    const scoreItems: Array<{ studentId: string; score: number }> = [];
    if (scoring) {
      const missing = students.filter((s) => needScore(s.id) && scoreById[s.id].trim() === "");
      if (missing.length > 0) {
        setErrorMessage(`Поставьте оценку присутствующим (0 — тоже оценка): ${missing.map((s) => s.name).join(", ")}.`);
        return;
      }
      for (const s of students) {
        const v = parsePoints(scoreById[s.id]);
        if (v === null) continue;
        if (Number.isNaN(v) || v < 0 || v > lessonMax + 1e-9) {
          setErrorMessage(`Оценка должна быть от 0 до ${formatPoints(lessonMax)}: ${s.name}.`);
          return;
        }
        scoreItems.push({ studentId: s.id, score: v });
      }
    }

    setIsSaving(true);
    (async () => {
      try {
        if (attendanceEditable) {
          const items = students.map((s) => ({ studentId: s.id, status: statusById[s.id] ?? "" }));
          const res = await saveAttendances({ classSessionId, items });
          if (!res.ok) {
            setErrorMessage(res.error);
            return;
          }
        }
        if (scoring) {
          const res = await saveLessonScores({ classSessionId, items: scoreItems });
          if (!res.ok) {
            setErrorMessage(`${attendanceEditable ? "Посещаемость сохранена, но оценки — нет: " : ""}${res.error}`);
            return;
          }
        }
        initialRef.current = { statuses: { ...statusById }, scores: { ...scoreById } };
        setOkMessage("Сохранено");
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push("/teacher");
      } catch {
        setErrorMessage("Ошибка сохранения. Попробуйте ещё раз.");
      } finally {
        setIsSaving(false);
      }
    })();
  }

  const statusHint = !attendanceEditable
    ? "Время правки посещаемости вышло (10 минут после занятия). Исправить её может куратор."
    : null;

  return (
    <>
      <BackToolbar style={{ marginBottom: 16 }}>
        <ExitButton disabled={isSaving || isDirty} to="/teacher" preferTo />
      </BackToolbar>

      {header ? <div>{header}</div> : null}

      {plan.available ? (
        <div style={box("info")}>
          <div style={{ fontWeight: 700 }}>
            Модуль {plan.moduleNo}, занятие {plan.lessonNo} из {plan.moduleLessons}
          </div>
          <div>
            За занятие: посещаемость {formatPoints(plan.attendancePerLesson)}, оценка до {formatPoints(plan.lessonMax)}.
            {plan.remainingAfter > 0 ? ` После него в модуле останется ${formatPoints(plan.remainingAfter)} балла текущего контроля.` : ""}
          </div>
        </div>
      ) : (
        <div style={box("info")}>
          <div>Оценки за занятие недоступны: {plan.reason}</div>
          {plan.code === "NO_CARD" || plan.code === "OUT_OF_PLAN" ? (
            <div style={{ marginTop: 6 }}>
              <Link
                href={`/teacher/tech-card?disciplineId=${encodeURIComponent(plan.disciplineId ?? "")}&programId=${encodeURIComponent(plan.programId ?? "")}&semesterId=${encodeURIComponent(plan.semesterId ?? "")}`}
                style={{ fontWeight: 800, textDecoration: "underline" }}
              >
                Открыть технологическую карту
              </Link>
            </div>
          ) : null}
        </div>
      )}

      {plan.available && plan.moduleClosed ? <div style={box("info")}>Модуль {plan.moduleNo} закрыт учебной частью: оценки больше не меняются.</div> : null}
      {statusHint ? <div style={box("info")}>{statusHint}</div> : null}
      {errorMessage ? <div style={box("error")}>{errorMessage}</div> : null}
      {okMessage ? <div style={box("ok")}>{okMessage}</div> : null}

      <ul style={{ display: "grid", gap: 10, padding: 0, margin: 0, listStyle: "none" }}>
        {students.map((student, idx) => {
          const current = statusById[student.id] ?? null;
          const lockedA = initialStatuses[student.id] === "A" || confirmedB.has(student.id);
          const statusDisabled = !attendanceEditable || isSaving || lockedA;
          const att =
            plan.available && current
              ? attendancePointsForLesson(confirmedB.has(student.id) ? "B_CONFIRMED" : current, plan.attendancePerLesson, plan.latePercent)
              : null;
          const raw = scoreById[student.id] ?? "";
          const parsed = parsePoints(raw);
          const invalid = scoring && parsed !== null && (Number.isNaN(parsed) || parsed > lessonMax + 1e-9);
          return (
            <li key={student.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "white" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    {idx + 1}. {student.name}
                  </div>
                  {plan.available ? (
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {att === null ? "посещение не отмечено" : `за посещение ${att > 0 ? "+" : ""}${formatPoints(att)}`}
                    </div>
                  ) : null}
                </div>
                {plan.available ? (
                  <input
                    inputMode="decimal"
                    aria-label={`Оценка: ${student.name}`}
                    placeholder={`из ${formatPoints(lessonMax)}`}
                    value={raw}
                    disabled={!scoring || isSaving}
                    onChange={(e) => setScore(student.id, e.target.value)}
                    style={{
                      width: 84,
                      height: 40,
                      textAlign: "right",
                      padding: "0 10px",
                      borderRadius: 10,
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor: invalid ? "#dc2626" : "#93c5fd",
                      fontWeight: 700,
                      fontSize: 15,
                      background: scoring ? "white" : "#f3f4f6",
                    }}
                  />
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {ORDER.map((k) => {
                  const active = current === k;
                  const disabled = k === "A" ? true : statusDisabled;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setStatus(student.id, k)}
                      disabled={disabled}
                      aria-pressed={active}
                      aria-label={`${student.name}: ${LABEL[k]}`}
                      title={k === "A" ? "Освобождение ставит администрация" : lockedA ? "Статус подтверждён администрацией" : undefined}
                      style={statusButtonStyle(k, active, disabled)}
                    >
                      {LABEL[k]}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          style={{
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "#111827",
            borderRadius: 12,
            padding: "12px 18px",
            fontWeight: 700,
            fontSize: 15,
            cursor: canSave ? "pointer" : "not-allowed",
            opacity: canSave ? 1 : 0.6,
            background: "#111827",
            color: "white",
          }}
        >
          {isSaving ? "Сохранение..." : attendanceEditable ? "Сохранить" : "Сохранить оценки"}
        </button>
        <div style={{ color: "#374151", fontWeight: 600, fontSize: 14 }}>
          {attendanceEditable
            ? unmarked > 0
              ? `Осталось отметить: ${unmarked}`
              : missingScores > 0
                ? `Нужны оценки: ${missingScores}`
                : "Всё заполнено"
            : missingScores > 0
              ? `Нужны оценки: ${missingScores}`
              : "Посещаемость закрыта"}
        </div>
      </div>
    </>
  );
}
