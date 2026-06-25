import { useMemo, type ReactNode } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  ComposedChart,
  Area,
} from 'recharts';
import { ESCALA_MOTORISTA_DIA } from '../../constants/escalaMotoristasDia';
import {
  NEON,
  NEON_PALETTE,
  type EquipeStats,
  type RestricoesMedicasStats,
  type RowEquipeChart,
  type TipoGraficoDashboard,
  type UnidadeOperacionalStats,
} from './dashboardGraficosNeonTheme';

export type { TipoGraficoDashboard };

export interface DashboardGraficosPanelProps {
  tipoGrafico: TipoGraficoDashboard;
  onTipoGraficoChange: (t: TipoGraficoDashboard) => void;
  periodoLabel: string;
  loadingAfastamentos: boolean;
  loadingPoliciais: boolean;
  totalPoliciaisCadastrados: number | null;
  totalPoliciaisAfastados: number | null;
  totalPoliciaisDisponiveis: number | null;
  totalFerias: number | null;
  totalAbono: number | null;
  totalRestricoesMedicas: number | null;
  restricoesMedicasData: RestricoesMedicasStats;
  feriasProgramadasSemAfastamentoCount: number | null;
  feriasAtrasadasSemAfastamentoCount: number | null;
  efetivoPorStatus: Record<string, number>;
  efetivoPorPosto: Record<string, number>;
  policiaisPorEquipe: Record<string, EquipeStats>;
  expedienteData: UnidadeOperacionalStats | null;
  motoristasData: UnidadeOperacionalStats | null;
  copomMulherData: UnidadeOperacionalStats | null;
  usuarioEhCpmulher: boolean;
  loadingExpediente?: boolean;
  loadingMotoristas?: boolean;
  loadingCopomMulher?: boolean;
}

type PontoValor = { name: string; value: number; color?: string };

const STATUS_ORDER: { key: string; label: string; color: string }[] = [
  { key: 'ATIVO', label: 'Ativo', color: NEON.colors.green },
  { key: 'PTTC', label: 'PTTC', color: NEON.colors.cyan },
  { key: 'DESIGNADO', label: 'Designado', color: NEON.colors.blue },
  { key: 'COMISSIONADO', label: 'Comissionado', color: NEON.colors.purple },
];

const POSTO_ORDER: { key: string; label: string; color: string }[] = [
  { key: 'oficiais', label: 'Oficiais', color: NEON.colors.indigo },
  { key: 'pracas', label: 'Praças', color: NEON.colors.cyan },
  { key: 'civis', label: 'Civis', color: NEON.colors.amber },
  { key: 'outros', label: 'Outros', color: NEON.colors.slate },
];

function pct(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

function NeonTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <Paper
      elevation={0}
      sx={{
        px: 1.5,
        py: 1,
        bgcolor: alpha('#020617', 0.94),
        border: `1px solid ${NEON.panelBorder}`,
        boxShadow: NEON.panelGlow,
        borderRadius: 1.5,
      }}
    >
      {label ? (
        <Typography variant="caption" sx={{ color: NEON.label, fontWeight: 700, display: 'block', mb: 0.5 }}>
          {label}
        </Typography>
      ) : null}
      {payload.map((p) => (
        <Typography key={String(p.name)} variant="caption" sx={{ color: p.color ?? NEON.colors.cyan, display: 'block' }}>
          {p.name}: <strong>{p.value ?? 0}</strong>
        </Typography>
      ))}
    </Paper>
  );
}

function NeonDefs() {
  return (
    <defs>
      <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id="neonBarGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={NEON.colors.cyan} stopOpacity={0.95} />
        <stop offset="100%" stopColor={NEON.colors.blue} stopOpacity={0.45} />
      </linearGradient>
    </defs>
  );
}

function chartAxisProps() {
  return {
    stroke: NEON.axis,
    tick: { fill: NEON.axis, fontSize: 11 },
    tickLine: { stroke: NEON.gridStroke },
  };
}

function KpiChip({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  color: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        flex: '1 1 140px',
        minWidth: 130,
        p: 1.5,
        borderRadius: 2,
        bgcolor: NEON.panelBg,
        border: `1px solid ${alpha(color, 0.35)}`,
        boxShadow: `0 0 18px ${alpha(color, 0.15)}`,
      }}
    >
      <Typography variant="caption" sx={{ color: NEON.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ color, fontWeight: 800, lineHeight: 1.2, mt: 0.25 }}>
        {value}
        {suffix ? (
          <Typography component="span" variant="body2" sx={{ color: NEON.muted, ml: 0.5 }}>
            {suffix}
          </Typography>
        ) : null}
      </Typography>
    </Paper>
  );
}

function SecaoNeon({
  titulo,
  subtitulo,
  children,
  size = { xs: 12, md: 6 },
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  size?: { xs: number; md?: number; lg?: number };
}) {
  return (
    <Grid size={size}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          height: '100%',
          borderRadius: 2.5,
          bgcolor: NEON.panelBg,
          border: `1px solid ${NEON.panelBorder}`,
          boxShadow: NEON.panelGlow,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
          <Box>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: '#e2e8f0',
                textShadow: `0 0 12px ${alpha(NEON.colors.cyan, 0.35)}`,
              }}
            >
              {titulo}
            </Typography>
            {subtitulo ? (
              <Typography variant="caption" sx={{ color: NEON.muted }}>
                {subtitulo}
              </Typography>
            ) : null}
          </Box>
        </Stack>
        {children}
      </Paper>
    </Grid>
  );
}

function ChartSimplesNeon({
  tipo,
  data,
  height = 280,
}: {
  tipo: TipoGraficoDashboard;
  data: PontoValor[];
  height?: number;
}) {
  const colors = data.map((d, i) => d.color ?? NEON_PALETTE[i % NEON_PALETTE.length]);

  if (data.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: NEON.muted, py: 4, textAlign: 'center' }}>
        Sem dados para exibir neste período.
      </Typography>
    );
  }

  if (tipo === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <NeonDefs />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={92}
            paddingAngle={3}
            label={({ name, percent }) => `${name} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i]} stroke={alpha(colors[i]!, 0.6)} strokeWidth={2} filter="url(#neonGlow)" />
            ))}
          </Pie>
          <Tooltip content={<NeonTooltip />} />
          <Legend wrapperStyle={{ color: NEON.label, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (tipo === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 64 }}>
          <NeonDefs />
          <CartesianGrid stroke={NEON.gridStroke} strokeDasharray="4 4" />
          <XAxis dataKey="name" angle={-32} textAnchor="end" height={72} interval={0} {...chartAxisProps()} />
          <YAxis allowDecimals={false} {...chartAxisProps()} />
          <Tooltip content={<NeonTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={NEON.colors.cyan}
            strokeWidth={3}
            dot={{ r: 5, fill: NEON.colors.cyan, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7 }}
            name="Quantidade"
            filter="url(#neonGlow)"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 64 }}>
        <NeonDefs />
        <CartesianGrid stroke={NEON.gridStroke} strokeDasharray="4 4" />
        <XAxis dataKey="name" angle={-32} textAnchor="end" height={72} interval={0} {...chartAxisProps()} />
        <YAxis allowDecimals={false} {...chartAxisProps()} />
        <Tooltip content={<NeonTooltip />} />
        <Bar dataKey="value" name="Quantidade" radius={[8, 8, 0, 0]} filter="url(#neonGlow)">
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartEquipesAgrupado({ rows, height = 300 }: { rows: RowEquipeChart[]; height?: number }) {
  const data = rows.map((r) => ({
    name: r.name,
    total: r.total,
    afastados: r.afastados,
    disponiveis: r.disponiveis,
    taxa: pct(r.afastados, r.total),
  }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
        <NeonDefs />
        <CartesianGrid stroke={NEON.gridStroke} strokeDasharray="4 4" />
        <XAxis dataKey="name" {...chartAxisProps()} />
        <YAxis allowDecimals={false} {...chartAxisProps()} />
        <Tooltip content={<NeonTooltip />} />
        <Legend wrapperStyle={{ color: NEON.label, fontSize: 12 }} />
        <Bar dataKey="total" fill={NEON.series.total} name="Total" radius={[4, 4, 0, 0]} />
        <Bar dataKey="afastados" fill={NEON.series.afastados} name="Afastados" radius={[4, 4, 0, 0]} filter="url(#neonGlow)" />
        <Bar dataKey="disponiveis" fill={NEON.series.disponiveis} name="Disponíveis" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartTaxaEquipes({ rows, height = 260 }: { rows: RowEquipeChart[]; height?: number }) {
  const data = rows.map((r) => ({ name: r.name, taxa: pct(r.afastados, r.total) }));
  if (data.every((d) => d.taxa === 0)) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
        <NeonDefs />
        <CartesianGrid stroke={NEON.gridStroke} strokeDasharray="4 4" />
        <XAxis dataKey="name" {...chartAxisProps()} />
        <YAxis unit="%" domain={[0, 'auto']} {...chartAxisProps()} />
        <Tooltip content={<NeonTooltip />} formatter={(v) => [`${v}%`, 'Taxa de afastamento']} />
        <Line
          type="monotone"
          dataKey="taxa"
          stroke={NEON.colors.orange}
          strokeWidth={3}
          dot={{ r: 5, fill: NEON.colors.orange }}
          name="Taxa (%)"
          filter="url(#neonGlow)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartPanoramaPeriodo({
  data,
  height = 300,
}: {
  data: { name: string; afastados: number; disponiveis: number; ferias: number; abono: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
        <NeonDefs />
        <CartesianGrid stroke={NEON.gridStroke} strokeDasharray="4 4" />
        <XAxis dataKey="name" {...chartAxisProps()} />
        <YAxis allowDecimals={false} {...chartAxisProps()} />
        <Tooltip content={<NeonTooltip />} />
        <Legend wrapperStyle={{ color: NEON.label, fontSize: 12 }} />
        <Area type="monotone" dataKey="disponiveis" fill={alpha(NEON.series.disponiveis, 0.15)} stroke={NEON.series.disponiveis} name="Disponíveis" />
        <Bar dataKey="afastados" fill={NEON.series.afastados} name="Afastados" radius={[4, 4, 0, 0]} />
        <Bar dataKey="ferias" fill={NEON.series.ferias} name="Férias" radius={[4, 4, 0, 0]} />
        <Bar dataKey="abono" fill={NEON.series.abono} name="Abono" radius={[4, 4, 0, 0]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ChartRadialTaxa({ taxa, height = 220 }: { taxa: number; height?: number }) {
  const data = [{ name: 'Afastados', value: taxa, fill: NEON.colors.orange }];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="58%"
        outerRadius="92%"
        barSize={14}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <RadialBar background={{ fill: alpha(NEON.colors.slate, 0.2) }} dataKey="value" cornerRadius={8} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill={NEON.colors.orange} fontSize={22} fontWeight={800}>
          {taxa}%
        </text>
        <Tooltip content={<NeonTooltip />} formatter={(v) => [`${v}%`, 'Taxa de afastamento']} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

export function DashboardGraficosPanel(props: DashboardGraficosPanelProps) {
  const {
    tipoGrafico,
    onTipoGraficoChange,
    periodoLabel,
    loadingAfastamentos,
    loadingPoliciais,
    totalPoliciaisCadastrados,
    totalPoliciaisAfastados,
    totalPoliciaisDisponiveis,
    totalFerias,
    totalAbono,
    totalRestricoesMedicas,
    restricoesMedicasData,
    feriasProgramadasSemAfastamentoCount,
    feriasAtrasadasSemAfastamentoCount,
    efetivoPorStatus,
    efetivoPorPosto,
    policiaisPorEquipe,
    expedienteData,
    motoristasData,
    copomMulherData,
    usuarioEhCpmulher,
  } = props;

  const taxaAfastamentoGeral = useMemo(() => {
    if (totalPoliciaisCadastrados == null || totalPoliciaisAfastados == null || totalPoliciaisCadastrados <= 0) {
      return null;
    }
    return pct(totalPoliciaisAfastados, totalPoliciaisCadastrados);
  }, [totalPoliciaisCadastrados, totalPoliciaisAfastados]);

  const outrosAfastamentos = useMemo(() => {
    if (totalPoliciaisAfastados == null || totalFerias == null || totalAbono == null) return null;
    return Math.max(0, totalPoliciaisAfastados - totalFerias - totalAbono);
  }, [totalPoliciaisAfastados, totalFerias, totalAbono]);

  const dadosIndicadoresMes: PontoValor[] = useMemo(() => {
    const out: PontoValor[] = [];
    if (totalPoliciaisAfastados != null) {
      out.push({ name: 'Afastados', value: totalPoliciaisAfastados, color: NEON.series.afastados });
    }
    if (totalPoliciaisDisponiveis != null) {
      out.push({ name: 'Disponíveis', value: totalPoliciaisDisponiveis, color: NEON.series.disponiveis });
    }
    if (totalFerias != null) {
      out.push({ name: 'Férias', value: totalFerias, color: NEON.series.ferias });
    }
    if (totalAbono != null) {
      out.push({ name: 'Abono', value: totalAbono, color: NEON.series.abono });
    }
    if (outrosAfastamentos != null && outrosAfastamentos > 0) {
      out.push({ name: 'Outros motivos', value: outrosAfastamentos, color: NEON.colors.indigo });
    }
    return out;
  }, [totalPoliciaisAfastados, totalPoliciaisDisponiveis, totalFerias, totalAbono, outrosAfastamentos]);

  const dadosComposicaoAfastamentos: PontoValor[] = useMemo(() => {
    const out: PontoValor[] = [];
    if (totalFerias != null && totalFerias > 0) out.push({ name: 'Férias', value: totalFerias, color: NEON.series.ferias });
    if (totalAbono != null && totalAbono > 0) out.push({ name: 'Abono', value: totalAbono, color: NEON.series.abono });
    if (outrosAfastamentos != null && outrosAfastamentos > 0) {
      out.push({ name: 'Demais motivos', value: outrosAfastamentos, color: NEON.colors.indigo });
    }
    return out;
  }, [totalFerias, totalAbono, outrosAfastamentos]);

  const dadosEfetivoStatus: PontoValor[] = useMemo(
    () => STATUS_ORDER.map((s) => ({ name: s.label, value: efetivoPorStatus[s.key] ?? 0, color: s.color })),
    [efetivoPorStatus],
  );

  const dadosEfetivoPosto: PontoValor[] = useMemo(
    () => POSTO_ORDER.map((p) => ({ name: p.label, value: (efetivoPorPosto[p.key] as number) ?? 0, color: p.color })),
    [efetivoPorPosto],
  );

  const equipesRows = useMemo(
    () =>
      ['A', 'B', 'C', 'D', 'E'].map((eq) => {
        const d = policiaisPorEquipe[eq] ?? { total: 0, afastados: 0, disponiveis: 0 };
        return { name: `Eq. ${eq}`, ...d };
      }),
    [policiaisPorEquipe],
  );

  const linhasOperacional = useMemo(() => {
    const rows: { name: string; total: number; afastados: number; disponiveis: number }[] = [];
    if (!usuarioEhCpmulher && expedienteData) {
      rows.push({ name: 'Expediente', ...expedienteData });
    }
    if (!usuarioEhCpmulher && motoristasData) {
      rows.push({ name: `Motoristas (${ESCALA_MOTORISTA_DIA})`, ...motoristasData });
    }
    if (copomMulherData) {
      rows.push({ name: 'COPOM Mulher', ...copomMulherData });
    }
    return rows;
  }, [expedienteData, motoristasData, copomMulherData, usuarioEhCpmulher]);

  const panoramaPeriodo = useMemo(
    () => [
      {
        name: 'COPOM',
        afastados: totalPoliciaisAfastados ?? 0,
        disponiveis: totalPoliciaisDisponiveis ?? 0,
        ferias: totalFerias ?? 0,
        abono: totalAbono ?? 0,
      },
    ],
    [totalPoliciaisAfastados, totalPoliciaisDisponiveis, totalFerias, totalAbono],
  );

  const dadosRestricoes: PontoValor[] = useMemo(
    () => [
      { name: 'Total ativas', value: restricoesMedicasData.total, color: NEON.series.restricao },
      { name: 'Neste mês', value: restricoesMedicasData.esteMes, color: NEON.colors.pink },
      { name: 'Hoje', value: restricoesMedicasData.hoje, color: NEON.colors.orange },
    ],
    [restricoesMedicasData],
  );

  const dadosAlertasFerias: PontoValor[] = useMemo(() => {
    const out: PontoValor[] = [];
    if (feriasProgramadasSemAfastamentoCount != null) {
      out.push({
        name: 'Programadas sem lançamento',
        value: feriasProgramadasSemAfastamentoCount,
        color: NEON.colors.amber,
      });
    }
    if (feriasAtrasadasSemAfastamentoCount != null) {
      out.push({
        name: 'Atrasadas sem lançamento',
        value: feriasAtrasadasSemAfastamentoCount,
        color: NEON.series.restricao,
      });
    }
    return out;
  }, [feriasProgramadasSemAfastamentoCount, feriasAtrasadasSemAfastamentoCount]);

  const carregando = loadingAfastamentos || loadingPoliciais;

  return (
    <Box
      id="dashboard-panel-graficos"
      role="tabpanel"
      aria-labelledby="dashboard-tab-graficos"
      sx={{
        py: 2,
        px: { xs: 0, sm: 0.5 },
        borderRadius: 2,
        background: `linear-gradient(165deg, ${alpha('#0b1f33', 0.55)} 0%, ${alpha('#020617', 0.35)} 100%)`,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <InsightsOutlinedIcon sx={{ color: NEON.colors.cyan, filter: `drop-shadow(0 0 8px ${NEON.colors.cyan})` }} />
          <Box>
            <Typography variant="subtitle1" sx={{ color: '#e2e8f0', fontWeight: 700 }}>
              Painel estatístico premium
            </Typography>
            <Typography variant="caption" sx={{ color: NEON.muted }}>
              Período: <strong style={{ color: NEON.label }}>{periodoLabel}</strong> — espelha os cards do Dashboard
            </Typography>
          </Box>
        </Stack>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="dashboard-tipo-grafico-label" sx={{ color: NEON.muted }}>
            Visualização
          </InputLabel>
          <Select
            labelId="dashboard-tipo-grafico-label"
            label="Visualização"
            value={tipoGrafico}
            onChange={(e) => onTipoGraficoChange(e.target.value as TipoGraficoDashboard)}
            sx={{
              color: NEON.label,
              '.MuiOutlinedInput-notchedOutline': { borderColor: NEON.panelBorder },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: NEON.colors.cyan },
            }}
          >
            <MenuItem value="bar">Barras neon</MenuItem>
            <MenuItem value="pie">Pizza neon</MenuItem>
            <MenuItem value="line">Linha neon</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {carregando ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={40} sx={{ color: NEON.colors.cyan }} />
        </Box>
      ) : (
        <>
          <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
            <KpiChip
              label="Efetivo cadastrado"
              value={totalPoliciaisCadastrados ?? '—'}
              color={NEON.colors.indigo}
            />
            <KpiChip
              label="Afastados no período"
              value={totalPoliciaisAfastados ?? '—'}
              color={NEON.series.afastados}
            />
            <KpiChip
              label="Disponíveis"
              value={totalPoliciaisDisponiveis ?? '—'}
              color={NEON.series.disponiveis}
            />
            <KpiChip
              label="Taxa de afastamento"
              value={taxaAfastamentoGeral ?? '—'}
              suffix={taxaAfastamentoGeral != null ? '%' : undefined}
              color={NEON.colors.orange}
            />
            <KpiChip
              label="Restrições médicas"
              value={totalRestricoesMedicas ?? restricoesMedicasData.total}
              color={NEON.series.restricao}
            />
          </Stack>

          <Grid container spacing={2}>
            <SecaoNeon titulo="Panorama do período" subtitulo="Afastados, disponíveis, férias e abono" size={{ xs: 12, lg: 8 }}>
              <ChartPanoramaPeriodo data={panoramaPeriodo} />
            </SecaoNeon>

            {taxaAfastamentoGeral != null && (
              <SecaoNeon titulo="Taxa geral de afastamento" subtitulo="Percentual sobre o efetivo cadastrado" size={{ xs: 12, lg: 4 }}>
                <ChartRadialTaxa taxa={taxaAfastamentoGeral} />
              </SecaoNeon>
            )}

            <SecaoNeon titulo="Indicadores do mês" subtitulo="Totais consolidados">
              <ChartSimplesNeon tipo={tipoGrafico} data={dadosIndicadoresMes} />
            </SecaoNeon>

            <SecaoNeon titulo="Composição dos afastamentos" subtitulo="Férias, abono e demais motivos">
              <ChartSimplesNeon tipo="pie" data={dadosComposicaoAfastamentos} />
            </SecaoNeon>

            <SecaoNeon titulo="Efetivo por status funcional">
              <ChartSimplesNeon tipo={tipoGrafico} data={dadosEfetivoStatus} />
            </SecaoNeon>

            <SecaoNeon titulo="Efetivo por posto / graduação">
              <ChartSimplesNeon tipo={tipoGrafico} data={dadosEfetivoPosto} />
            </SecaoNeon>

            <SecaoNeon
              titulo="Equipes A–E — total, afastados e disponíveis"
              subtitulo="Relação completa por equipe operacional"
              size={{ xs: 12 }}
            >
              <ChartEquipesAgrupado rows={equipesRows} />
            </SecaoNeon>

            <SecaoNeon titulo="Taxa de afastamento por equipe" subtitulo="Percentual de afastados sobre o total da equipe">
              <ChartTaxaEquipes rows={equipesRows} />
            </SecaoNeon>

            <SecaoNeon titulo="Disponíveis por equipe" subtitulo="Políciais aptos no período">
              <ChartSimplesNeon
                tipo={tipoGrafico}
                data={equipesRows.map((r, i) => ({
                  name: r.name,
                  value: r.disponiveis,
                  color: NEON_PALETTE[i % NEON_PALETTE.length],
                }))}
              />
            </SecaoNeon>

            {linhasOperacional.length > 0 && (
              <SecaoNeon
                titulo="Unidades especiais"
                subtitulo={`Expediente, motoristas (${ESCALA_MOTORISTA_DIA}) e COPOM Mulher`}
                size={{ xs: 12 }}
              >
                <ChartEquipesAgrupado rows={linhasOperacional} height={280} />
              </SecaoNeon>
            )}

            <SecaoNeon titulo="Restrições médicas" subtitulo="Total, ocorrências no mês e hoje">
              <ChartSimplesNeon tipo={tipoGrafico} data={dadosRestricoes} />
            </SecaoNeon>

            {dadosAlertasFerias.length > 0 && (
              <SecaoNeon
                titulo="Alertas de férias"
                subtitulo="Previsão sem lançamento ou período atrasado"
                size={{ xs: 12, md: 6 }}
              >
                <ChartSimplesNeon tipo={tipoGrafico} data={dadosAlertasFerias} />
                <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
                  {dadosAlertasFerias.map((d) => (
                    <Chip
                      key={d.name}
                      label={`${d.name}: ${d.value}`}
                      size="small"
                      sx={{
                        bgcolor: alpha(d.color ?? NEON.colors.cyan, 0.12),
                        color: d.color,
                        border: `1px solid ${alpha(d.color ?? NEON.colors.cyan, 0.35)}`,
                      }}
                    />
                  ))}
                </Stack>
              </SecaoNeon>
            )}
          </Grid>
        </>
      )}
    </Box>
  );
}
