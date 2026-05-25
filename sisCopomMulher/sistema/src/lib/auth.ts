import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import type { UserRole } from "@prisma/client";
import { SESSION_COOKIE } from "./constants";

export type SessionPayload = {
  sub: string;
  email: string;
  role: UserRole;
  nome: string;
  mustChangePassword: boolean;
};

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET deve ter pelo menos 16 caracteres.");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload, maxAgeSec = 60 * 60 * 8) {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    nome: payload.nome,
    mustChangePassword: payload.mustChangePassword === true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sub = String(payload.sub ?? "");
    const email = String(payload.email ?? "");
    const role = payload.role as UserRole;
    const nome = String(payload.nome ?? "");
    const mustChangePassword = payload.mustChangePassword === true;
    if (!sub || !email || !role) return null;
    return { sub, email, role, nome, mustChangePassword };
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

async function sessionCookieSecureFromHeaders(): Promise<boolean> {
  const h = await headers();
  const host = h.get("host") ?? "";
  const hHost = host.split(":")[0]?.replace(/^\[|\]$/g, "").toLowerCase() ?? "";
  const loopback = hHost === "localhost" || hHost === "127.0.0.1" || hHost === "::1" || hHost.endsWith(".localhost");
  const fwd = h.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (loopback && fwd !== "https") return false;

  const o = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (o === "1" || o === "true" || o === "yes") return true;
  if (o === "0" || o === "false" || o === "no") return false;
  if (fwd === "https") return true;
  if (fwd === "http") return false;
  return false;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  const secure = await sessionCookieSecureFromHeaders();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  const secure = await sessionCookieSecureFromHeaders();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
}
