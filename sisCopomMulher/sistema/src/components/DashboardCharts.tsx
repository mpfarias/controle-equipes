"use client";

import { useId, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import type { DashboardStats } from "@/server/services/dashboard.service";

export type { DashboardStats };

const COLORS = ["#db2777", "#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626", "#0ea5e9", "#64748b"];

const tooltipStyle = {
  borderRadius: 14,
  border: "1px solid rgba(236, 72, 153, 0.35)",
  fontSize: 12,
  boxShadow: "0 12px 40px -12px rgba(99, 102, 241, 0.35), 0 0 0 1px rgba(255,255,255,0.8) inset",
  background: "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(250,245,255,0.96) 100%)",
};

function Card({
  title,
  subtitle,
  children,
  titleClassName = "",
  subtitleClassName = "",
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Ex.: `text-center` para alinhar o título ao centro. */
  titleClassName?: string;
  /** Ex.: `text-center` para alinhar o subtítulo ao centro. */
  subtitleClassName?: string;
}) {
  return (
    <div className="dashboard-chart-card">
      <div className="dashboard-chart-card__inner p-4">
        <div className="dashboard-chart-card__ambient" aria-hidden />
        <div className="dashboard-chart-card__shine" aria-hidden />
        <div className="relative z-10">
          <div className={`dashboard-chart-card__title mb-2 text-sm font-bold tracking-tight ${titleClassName}`.trim()}>{title}</div>
          {subtitle ? (
            <div className={`mb-2 text-[10px] leading-snug text-slate-600 ${subtitleClassName}`.trim()}>{subtitle}</div>
          ) : null}
          <div className="h-72 w-full min-h-0 [filter:drop-shadow(0_4px_20px_rgba(139,92,246,0.15))]">{children}</div>
        </div>
      </div>
    </div>
  );
}

function DashboardCharts({ stats }: { stats: DashboardStats }) {
  const gid = useId().replace(/:/g, "");

  const revertidasPorMesAlinhado = useMemo(() => {
    const rev = new Map(stats.revertidasCopomPorMes.map((r) => [r.mes, r.total]));
    const meses = new Set([...stats.porMes.map((r) => r.mes), ...stats.revertidasCopomPorMes.map((r) => r.mes)]);
    return [...meses].sort().map((mes) => ({
      mes,
      revertidas: rev.get(mes) ?? 0,
    }));
  }, [stats.porMes, stats.revertidasCopomPorMes]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card
        title="Ocorrências Revertidas pelo COPOM Mulher"
        titleClassName="text-center"
        subtitleClassName="text-center"
        subtitle={
          <span className="font-semibold text-fuchsia-900">
            Total revertidas no período: {stats.revertidasCopomTotal.toLocaleString("pt-BR")}
          </span>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={revertidasPorMesAlinhado} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={`${gid}-rev-bar`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbcfe8" stopOpacity={1} />
                <stop offset="45%" stopColor="#f472b6" stopOpacity={1} />
                <stop offset="100%" stopColor="#c026d3" stopOpacity={1} />
              </linearGradient>
              <linearGradient id={`${gid}-rev-line`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(167, 139, 250, 0.35)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "rgba(148, 163, 184, 0.5)" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} width={36} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="revertidas" name="Revertidas" fill={`url(#${gid}-rev-bar)`} radius={[6, 6, 0, 0]} maxBarSize={44} />
            <Line
              type="monotone"
              dataKey="revertidas"
              name="Tendência"
              stroke={`url(#${gid}-rev-line)`}
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#6366f1", stroke: "#fff", strokeWidth: 1 }}
              activeDot={{ r: 6, fill: "#7c3aed", stroke: "#fff", strokeWidth: 2 }}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Gráfico por Região" titleClassName="text-center">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.porRegiao} layout="vertical" margin={{ left: 8, right: 16 }}>
            <defs>
              <linearGradient id={`${gid}-regiao`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ddd6fe" />
                <stop offset="35%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#5b21b6" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(167, 139, 250, 0.3)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "rgba(148, 163, 184, 0.45)" }} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" name="Ocorrências" fill={`url(#${gid}-regiao)`} radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Tipo de Agressão (top 5)" titleClassName="text-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {COLORS.map((c, i) => (
                <radialGradient key={i} id={`${gid}-pie-t-${i}`} cx="42%" cy="38%" r="78%">
                  <stop offset="0%" stopColor="#fff" stopOpacity={0.95} />
                  <stop offset="35%" stopColor={c} stopOpacity={1} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.88} />
                </radialGradient>
              ))}
            </defs>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Pie
              data={stats.porTipoAgressao}
              dataKey="value"
              nameKey="name"
              outerRadius={112}
              innerRadius={22}
              paddingAngle={2}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={2}
              label={{ fontSize: 10, fill: "#475569" }}
            >
              {stats.porTipoAgressao.map((_, i) => (
                <Cell key={i} fill={`url(#${gid}-pie-t-${i % COLORS.length})`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Desfecho (top 10)" titleClassName="text-center">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.porDesfecho}>
            <defs>
              <linearGradient id={`${gid}-desfecho`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="55%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#a7f3d0" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(16, 185, 129, 0.28)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-18} textAnchor="end" height={70} axisLine={{ stroke: "rgba(148, 163, 184, 0.45)" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" name="Quantidade" fill={`url(#${gid}-desfecho)`} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

export { DashboardCharts };
export default DashboardCharts;
