import type { NextRequest } from "next/server";

export function readBearerToken(req: NextRequest): string | null {
  const a = req.headers.get("authorization");
  if (!a) return null;
  const m = /^Bearer\s+(.+)$/i.exec(a.trim());
  return m?.[1]?.trim() || null;
}
