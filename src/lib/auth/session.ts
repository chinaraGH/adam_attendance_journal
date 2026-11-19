import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "ejp_session";

function getSecret() {
  const configured = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not set. Set it in the environment before running in production.");
  }
  const secret = configured ?? "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string;
  role: string;
};

export async function signSessionToken(input: SessionPayload) {
  const secret = getSecret();
  return new SignJWT({ role: input.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const role = typeof (payload as any).role === "string" ? String((payload as any).role) : null;
    if (!sub || !role) return null;
    return { sub, role };
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

