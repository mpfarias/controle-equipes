import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/constants";
import { sessionCookieSecureFromRequest } from "@/lib/session-cookie-secure";
import { registrarAuditoria } from "@/lib/audit";
import { clientIp, clientUa } from "@/lib/request-meta";

/**
 * Hosts como `[::]:3001` ou `0.0.0.0:3001` geram Location inválido no browser.
 * Para logout redirecionamos sempre para um host que o utilizador consiga abrir.
 */
function requestOriginForBrowserRedirect(req: NextRequest): string {
  const protoRaw =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (req.nextUrl.protocol === "https:" ? "https" : "http");
  const proto = protoRaw.replace(/:$/, "");

  const fwdHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = req.headers.get("host")?.trim() || req.nextUrl.host;
  const host = fwdHost || hostHeader;

  const defaultPort = String(process.env.PORT || "3001").trim() || "3001";
  const portFromHost = (h: string) => {
    const m = h.match(/:(\d+)$/);
    return m?.[1] ?? defaultPort;
  };

  const needsLoopback =
    !host ||
    host.startsWith("[::]") ||
    host.startsWith("[::1]") ||
    host === "::" ||
    host.startsWith("0.0.0.0");

  if (needsLoopback) {
    const p = portFromHost(host || `127.0.0.1:${defaultPort}`);
    return `${proto}://127.0.0.1:${p}`;
  }

  return `${proto}://${host}`;
}

function clearSessionCookie(req: NextRequest, res: NextResponse) {
  const secure = sessionCookieSecureFromRequest(req);
  // Limpa o cookie no mesmo path e com as mesmas flags.
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
}

async function auditLogout(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (session) {
    await registrarAuditoria({
      userId: session.sub,
      acao: "LOGOUT",
      entidade: "User",
      entidadeId: session.sub,
      ip: clientIp(req),
      userAgent: clientUa(req),
    });
  }
}

export async function POST(req: NextRequest) {
  await auditLogout(req);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(req, res);
  return res;
}

export async function GET(req: NextRequest) {
  await auditLogout(req);
  const nextRaw = req.nextUrl.searchParams.get("next") ?? "/login";
  const nextPath = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/login";
  const dest = new URL(nextPath, `${requestOriginForBrowserRedirect(req)}/`);
  const res = NextResponse.redirect(dest);
  clearSessionCookie(req, res);
  return res;
}
