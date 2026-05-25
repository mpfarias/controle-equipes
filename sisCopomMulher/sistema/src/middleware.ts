import { NextResponse, type NextRequest } from "next/server";
import { readSessionFromToken } from "./lib/session-edge";
import { SESSION_COOKIE } from "./lib/constants";

const publicPaths = ["/login", "/api/auth/login", "/api/health", "/mobile-vitima", "/teste-chrome", "/simulador-celular"];

function isPublic(pathname: string) {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Origem do pedido como o cliente a vê (Host / forwarded), não `req.url` —
 * no dev o Next pode expor `req.url` com `localhost` mesmo para pedidos a `127.0.0.1`.
 */
function requestOrigin(req: NextRequest): string {
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    req.nextUrl.host;
  const rawProto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (req.nextUrl.protocol === "https:" ? "https" : "http");
  const proto = rawProto.replace(/:$/, "");
  return `${proto}://${host}`;
}

/** Garante que o `Location` mantém o mesmo host que o pedido (127.0.0.1 vs localhost). */
function redirectSameOrigin(req: NextRequest, pathname: string, clearSearch = false) {
  const u = new URL(pathname, `${requestOrigin(req)}/`);
  if (clearSearch) u.search = "";
  return NextResponse.redirect(u);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|gif)$/)
  ) {
    return NextResponse.next();
  }

  /** Página pública informativa em /mobile-vitima (não em /app/…); o fluxo operacional da vítima é a app. */
  if (pathname === "/app/mobile-vitima" || pathname.startsWith("/app/mobile-vitima/")) {
    return NextResponse.redirect(new URL("/mobile-vitima", `${requestOrigin(req)}/`));
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/logout") || pathname.startsWith("/api/auth/me")) {
    return NextResponse.next();
  }

  /** App móvel da vítima: autenticação por Bearer (token de ativação), não por cookie de sessão. */
  if (pathname.startsWith("/api/mobile")) {
    return NextResponse.next();
  }

  /** Cadastro e pânico pelo app / página vítima — identificação por telefone no corpo, sem sessão web. */
  if (pathname.startsWith("/api/vitima-app")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const u = new URL("/login", `${requestOrigin(req)}/`);
    u.searchParams.set("next", pathname);
    return NextResponse.redirect(u);
  }

  let session: Awaited<ReturnType<typeof readSessionFromToken>>;
  try {
    session = await readSessionFromToken(token);
  } catch {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }
    return redirectSameOrigin(req, "/login", true);
  }

  if (session.mustChangePassword) {
    const allowed =
      pathname === "/app/alterar-senha-primeiro-acesso" ||
      pathname.startsWith("/app/alterar-senha-primeiro-acesso/") ||
      pathname.startsWith("/api/auth/change-password") ||
      pathname.startsWith("/api/auth/logout") ||
      pathname.startsWith("/api/auth/me");
    if (!allowed) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Altere a senha provisória antes de continuar.", code: "MUST_CHANGE_PASSWORD" }, { status: 403 });
      }
      return redirectSameOrigin(req, "/app/alterar-senha-primeiro-acesso", true);
    }
  }

  if (pathname.startsWith("/api/import")) {
    if (session.role !== "ADMINISTRADOR") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/app")) {
    if (session.role === "CONSULTA") {
      if (pathname.startsWith("/app/ocorrencias/nova")) {
        return redirectSameOrigin(req, "/app/ocorrencias", true);
      }
      const consultaOk =
        pathname.startsWith("/app/dashboard") ||
        pathname.startsWith("/app/ocorrencias");
      if (!consultaOk) {
        return redirectSameOrigin(req, "/app/dashboard", true);
      }
    }
    if (session.role === "ATENDENTE" && pathname.startsWith("/app/usuarios")) {
      return redirectSameOrigin(req, "/app/dashboard", true);
    }
    if (session.role !== "ADMINISTRADOR" && pathname.startsWith("/app/admin")) {
      return redirectSameOrigin(req, "/app/dashboard", true);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
