"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";

import { formatRoleLabel } from "@/lib/ui/labels";

import { loginWithPassword } from "./actions";

type UserRow = { id: string; role: string };
type State = { ok: true } | { ok: false; error: string };

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "white",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 800,
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  appearance: "none",
  border: "1px solid #111827",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 900,
  fontFamily: "inherit",
  fontSize: 13,
  lineHeight: "inherit",
  textDecoration: "none",
  color: "white",
  background: "#111827",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      style={{
        ...primaryButtonStyle,
        marginTop: 8,
        ...(pending ? { cursor: "not-allowed", opacity: 0.6, borderColor: "#e5e7eb", background: "#9ca3af" } : { cursor: "pointer" }),
      }}
    >
      {pending ? "Входим..." : "Войти"}
    </button>
  );
}

export function LoginForm(props: { users: UserRow[]; dbUnavailable?: boolean }) {
  const [state, formAction] = useFormState<State, FormData>(loginWithPassword as any, { ok: false, error: "" });
  const loginRef = React.useRef<HTMLInputElement | null>(null);

  const usersByRole = React.useMemo(() => {
    const m = new Map<string, UserRow[]>();
    for (const u of props.users) {
      const r = String(u.role);
      m.set(r, [...(m.get(r) ?? []), u]);
    }
    for (const [k, v] of m) {
      v.sort((a, b) => a.id.localeCompare(b.id));
      m.set(k, v);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [props.users]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <form action={formAction} style={{ ...cardStyle, display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 900, color: "#111827" }}>
          Логин
          <input
            ref={loginRef}
            name="login"
            autoComplete="username"
            placeholder="Например: ADMIN_TEST"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 900, color: "#111827" }}>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Введите пароль"
            style={inputStyle}
          />
        </label>

        {state.ok === false && state.error ? (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 800,
              color: "#b91c1c",
            }}
          >
            Неверный логин или пароль
          </div>
        ) : null}

        <SubmitButton />
      </form>

      <details style={cardStyle} open={props.dbUnavailable && props.users.length === 0}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900 }}>
          Тестовые логины (по ролям)
        </summary>
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
          Нажмите на логин, чтобы подставить его в поле «Логин». Пароль — одинаковый для всех тестовых аккаунтов.
        </div>
        {props.dbUnavailable && props.users.length === 0 ? (
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: "#92400e" }}>
            Список не загружен: без базы нельзя подсмотреть тестовые id, но вручную можно ввести логин из seed (например
            TEACHER_TEST) после проверки DATABASE_URL.
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {usersByRole.map(([role, items]) => (
            <div key={role} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900 }}>{formatRoleLabel(role)}</div>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {items.slice(0, 8).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 900,
                      background: "white",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (loginRef.current) {
                        loginRef.current.value = u.id;
                        loginRef.current.focus();
                      }
                    }}
                  >
                    {u.id}
                  </button>
                ))}
                {items.length > 8 ? (
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>и ещё {items.length - 8}…</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

