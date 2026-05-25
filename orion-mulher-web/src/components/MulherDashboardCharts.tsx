import { useId, useMemo } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MulherDashboardStats } from '../types';

const COLORS = ['#db2777', '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0ea5e9', '#64748b'];
const accent = '#f472b6';

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid rgba(244, 114, 182, 0.35)',
  borderRadius: 12,
  color: '#e2e8f0',
  fontSize: 12,
};

function ChartCard({
  title,
  subtitle,
  children,
  titleAlign = 'left',
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  titleAlign?: 'left' | 'center';
}) {
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: alpha('#0f172a', 0.65),
        border: `1px solid ${alpha(accent, 0.2)}`,
        height: '100%',
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 700, mb: subtitle ? 0.5 : 1.5, textAlign: titleAlign }}
      >
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" sx={{ display: 'block', mb: 1.5, textAlign: titleAlign, color: accent }}>
          {subtitle}
        </Typography>
      ) : null}
      <Box sx={{ height: 288, width: '100%', minHeight: 0 }}>{children}</Box>
    </Paper>
  );
}

export function MulherDashboardCharts({ stats }: { stats: MulherDashboardStats }) {
  const gid = useId().replace(/:/g, '');

  const revertidasPorMesAlinhado = useMemo(() => {
    const rev = new Map(stats.revertidasCopomPorMes.map((r) => [r.mes, r.total]));
    const meses = new Set([
      ...stats.porMes.map((r) => r.mes),
      ...stats.revertidasCopomPorMes.map((r) => r.mes),
    ]);
    return [...meses].sort().map((mes) => ({
      mes,
      revertidas: rev.get(mes) ?? 0,
    }));
  }, [stats.porMes, stats.revertidasCopomPorMes]);

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
      <ChartCard
        title="Ocorrências revertidas pelo COPOM Mulher"
        titleAlign="center"
        subtitle={`Total revertidas no período: ${stats.revertidasCopomTotal.toLocaleString('pt-BR')}`}
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(167, 139, 250, 0.25)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={36} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
            <Bar
              dataKey="revertidas"
              name="Revertidas"
              fill={`url(#${gid}-rev-bar)`}
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
            />
            <Line
              type="monotone"
              dataKey="revertidas"
              name="Tendência"
              stroke={`url(#${gid}-rev-line)`}
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 1 }}
              activeDot={{ r: 6, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Gráfico por região" titleAlign="center">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.porRegiao} layout="vertical" margin={{ left: 8, right: 16 }}>
            <defs>
              <linearGradient id={`${gid}-regiao`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ddd6fe" />
                <stop offset="35%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#5b21b6" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(167, 139, 250, 0.2)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: '#cbd5e1' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" name="Ocorrências" fill={`url(#${gid}-regiao)`} radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tipo de agressão (top 5)" titleAlign="center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
            <Pie
              data={stats.porTipoAgressao}
              dataKey="value"
              nameKey="name"
              outerRadius={112}
              innerRadius={22}
              paddingAngle={2}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={2}
              label={{ fontSize: 10, fill: '#94a3b8' }}
            >
              {stats.porTipoAgressao.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Desfecho (top 10)" titleAlign="center">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.porDesfecho}>
            <defs>
              <linearGradient id={`${gid}-desfecho`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="55%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#a7f3d0" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(16, 185, 129, 0.2)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={70}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" name="Quantidade" fill={`url(#${gid}-desfecho)`} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </Box>
  );
}
