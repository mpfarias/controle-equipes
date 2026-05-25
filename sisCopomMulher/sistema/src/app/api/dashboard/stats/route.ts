import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { firstSearchParam, resolveDashboardRange } from "@/lib/dashboard-date-range";
import { podeVerDashboard } from "@/lib/roles";
import { computeDashboardStats } from "@/server/services/dashboard.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "no-store, max-age=0, must-revalidate" as const };

function normalizeDateParam(v: unknown): string {
  if (v == null) return "";
  if (typeof v !== "string") return "";
  return v.trim();
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!podeVerDashboard(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromStr = firstSearchParam(searchParams.get("from"));
  const toStr = firstSearchParam(searchParams.get("to"));
  const resolved = resolveDashboardRange(fromStr, toStr);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const stats = await computeDashboardStats(resolved.range);
  return NextResponse.json({ ...stats, requesterRole: session.role }, { headers: noStore });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!podeVerDashboard(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { from?: unknown; to?: unknown };
  const fromStr = normalizeDateParam(body.from);
  const toStr = normalizeDateParam(body.to);
  const resolved = resolveDashboardRange(fromStr, toStr);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const stats = await computeDashboardStats(resolved.range);
  return NextResponse.json({ ...stats, requesterRole: session.role }, { headers: noStore });
}
