import type { NextRequest } from "next/server";

export function clientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

export function clientUa(req: NextRequest) {
  return req.headers.get("user-agent");
}
