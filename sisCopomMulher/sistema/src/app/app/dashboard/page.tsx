import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { firstSearchParam, resolveDashboardRange } from "@/lib/dashboard-date-range";
import { podeVerDashboard } from "@/lib/roles";
import { computeDashboardStats } from "@/server/services/dashboard.service";
import { DashboardShell } from "./dashboard-shell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Mesmo intervalo do preset «Ano em curso» (1 jan → hoje, meio-dia local). */
function hrefAnoEmCurso(): string {
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const y = hoje.getFullYear();
  const m = String(hoje.getMonth() + 1).padStart(2, "0");
  const day = String(hoje.getDate()).padStart(2, "0");
  return `/app/dashboard?from=${y}-01-01&to=${y}-${m}-${day}`;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/app/dashboard");
  }
  if (!podeVerDashboard(session.role)) {
    redirect("/login?next=/app/dashboard");
  }

  const raw = await searchParams;
  const periodo = firstSearchParam(raw?.periodo).toLowerCase();
  const fromStr = firstSearchParam(raw?.from);
  const toStr = firstSearchParam(raw?.to);

  if (periodo === "todos") {
    const resolved = resolveDashboardRange("", "");
    const shellKey = "dash-todos";
    if (!resolved.ok) {
      return <DashboardShell key={shellKey} fromStr="" toStr="" periodoTodos stats={null} rangeError={resolved.error} />;
    }
    const stats = await computeDashboardStats(resolved.range);
    return <DashboardShell key={shellKey} fromStr="" toStr="" periodoTodos stats={stats} rangeError={null} />;
  }

  if (!fromStr && !toStr) {
    redirect(hrefAnoEmCurso());
  }

  const resolved = resolveDashboardRange(fromStr, toStr);
  const shellKey = `dash-${fromStr}|${toStr}`;

  if (!resolved.ok) {
    return <DashboardShell key={shellKey} fromStr={fromStr} toStr={toStr} stats={null} rangeError={resolved.error} />;
  }

  const stats = await computeDashboardStats(resolved.range);
  return <DashboardShell key={shellKey} fromStr={fromStr} toStr={toStr} stats={stats} rangeError={null} />;
}
