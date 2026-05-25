import type { NextRequest } from "next/server";

/**
 * `Secure` no cookie só quando a ligação ao cliente é HTTPS (ou proxy indica HTTPS).
 * Opção B em HTTP (localhost, IP da rede) falhava o login se `secure` fosse sempre true em produção.
 *
 * Forçar: COOKIE_SECURE=1 (sempre) ou COOKIE_SECURE=0 (nunca).
 */
function hostIsLoopback(host: string): boolean {
  const h = host.split(":")[0]?.replace(/^\[|\]$/g, "").toLowerCase() ?? "";
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost");
}

export function sessionCookieSecureFromRequest(req: Pick<NextRequest, "headers" | "nextUrl">): boolean {
  const host = req.headers.get("host") ?? "";
  /** Em HTTP local, `Secure` faz o browser descartar o cookie — parece “login que não entra”. */
  if (hostIsLoopback(host) && req.nextUrl.protocol !== "https:") return false;

  const o = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (o === "1" || o === "true" || o === "yes") return true;
  if (o === "0" || o === "false" || o === "no") return false;

  const fwd = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (fwd === "https") return true;
  if (fwd === "http") return false;

  return req.nextUrl.protocol === "https:";
}
