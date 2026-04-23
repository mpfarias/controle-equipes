import { useMemo } from 'react';
import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
  Grid,
} from '@mui/material';
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
} from 'recharts';
import { ESCALA_MOTORISTA_DIA } from '../../constants/escalaMotoristasDia';

export type TipoGraficoDashboard = 'bar' | 'pie' | 'line';

const PALETTE = ['#6366f1', '#3b82f6', '#86C99E', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316'];

export interface DashboardGraficosPanelProps {
  tipoGrafico: TipoGraficoDashboard;
  onTipoGraficoChange: (t: TipoGraficoDashboard) => void;
  periodoLabel: string;
  loadingAfastamentos: boolean;
  loadingPoliciais: boolean;
  totalPoliciaisAfastados: number | null;
  totalPoliciaisDisponiveis: number | null;
  totalFerias: number | null;
  totalAbono: number | null;
  efetivoPorStatus: Record<string, number>;
  efetivoPorPosto: Record<string, number>;
  policiaisPorEquipe: Record<string, { total: number; afastados: number; disponiveis: number }>;
  expedienteData: { total: number; afastados: number; disponiveis: number } | null;
  motoristasData: { total: number; afastados: number; disponiveis: number } | null;
  copomMulherData: { total: number; afastados: number; disponiveis: number } | null;
  usuarioEhCpmulher: boolean;
}

type PontoValor = { name: string; value: number; color?: string };

const STATUS_ORDER: { key: string; label: string }[] = [
  { key: 'ATIVO', label: 'Ativo' },
  { key: 'PTTC', label: 'PTTC' },
  { key: 'DESIGNADO', label: 'Designado' },
  { key: 'COMISSIONADO', label: 'Comissionado' },
];

const POSTO_ORDER: { key: keyof DashboardGraficosPanelProps['efetivoPorPosto']; label: string }[] = [
  { key: 'oficiais', label: 'Oficiais' },
  { key: 'pracas', label: 'Praças' },
  { key: 'civis', label: 'Civis' },
  { key: 'outros', label: 'Outros' },
];

function ChartSimples({
  tipo,
  data,
  height = 300,
}: {
  tipo: TipoGraficoDashboard;
  data: PontoValor[];
  height?: number;
}) {
  const colors = data.map((d, i) => d.color ?? PALETTE[i % PALETTE.length]);

  if (data.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        Sem dados para exibir neste período.
      </Typography>
    );
  }

  if (tipo === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${name ?? ''} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [v ?? 0, 'Quantidade']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (tipo === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 72 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-38} textAnchor="end" height={90} interval={0} tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Quantidade" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 72 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-38} textAnchor="end" height={90} interval={0} tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" name="Quantidade" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Gráfico de barras agrupadas: Total, Afastados, Disponíveis por setor */
function ChartOperacionalBarras({
  rows,
  height = 320,
}: {
  rows: { name: string; total: number; afastados: number; disponiveis: number }[];
  height?: number;
}) {
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        Sem dados.
      </Typography>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="total" fill="#94a3b8" name="Total" radius={[4, 4, 0, 0]} />
        <Bar dataKey="afastados" fill="#f59e0b" name="Afastados" radius={[4, 4, 0, 0]} />
        <Bar dataKey="disponiveis" fill="#86C99E" name="Disponíveis" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartOperacionalLinhas({
  rows,
  height = 320,
}: {
  rows: { name: string; total: number; afastados: number; disponiveis: number }[];
  height?: number;
}) {
  if (rows.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="total" stroke="#94a3b8" name="Total" dot />
        <Line type="monotone" dataKey="afastados" stroke="#f59e0b" name="Afastados" dot />
        <Line type="monotone" dataKey="disponiveis" stroke="#86C99E" name="Disponíveis" dot />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MiniPies({
  items,
}: {
  items: { titulo: string; fatias: { name: string; value: number }[] }[];
}) {
  return (
    <Grid container spacing={2}>
      {items.map((bloco) => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={bloco.titulo}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, textAlign: 'center' }}>
            {bloco.titulo}
          </Typography>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={bloco.fatias}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                label
              >
                {bloco.fatias.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [v ?? 0, '']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Grid>
      ))}
    </Grid>
  );
}

function SecaoGrafico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
        {titulo}
      </Typography>
      {children}
    </Paper>
  );
}

export function DashboardGraficosPanel(props: DashboardGraficosPanelProps) {
  const {
    tipoGrafico,
    onTipoGraficoChange,
    periodoLabel,
    loadingAfastamentos,
    loadingPoliciais,
    totalPoliciaisAfastados,
    totalPoliciaisDisponiveis,
    totalFerias,
    totalAbono,
    efetivoPorStatus,
    efetivoPorPosto,
    policiaisPorEquipe,
    expedienteData,
    motoristasData,
    copomMulherData,
    usuarioEhCpmulher,
  } = props;

  const dadosIndicadoresMes: PontoValor[] = useMemo(() => {
    const out: PontoValor[] = [];
    if (totalPoliciaisAfastados != null) {
      out.push({ name: 'Afastados no mês', value: totalPoliciaisAfastados, color: '#3b82f6' });
    }
    if (totalPoliciaisDisponiveis != null) {
      out.push({ name: 'Disponíveis', value: totalPoliciaisDisponiveis, color: '#86C99E' });
    }
    if (totalFerias != null) {
      out.push({ name: 'Férias', value: totalFerias, color: '#f59e0b' });
    }
    if (totalAbono != null) {
      out.push({ name: 'Abono', value: totalAbono, color: '#ec4899' });
    }
    return out;
  }, [totalPoliciaisAfastados, totalPoliciaisDisponiveis, totalFerias, totalAbono]);

  const dadosEfetivoStatus: PontoValor[] = useMemo(
    () =>
      STATUS_ORDER.map((s, i) => ({
        name: s.label,
        value: efetivoPorStatus[s.key] ?? 0,
        color: PALETTE[i % PALETTE.length],
      })),
    [efetivoPorStatus],
  );

  const dadosEfetivoPosto: PontoValor[] = useMemo(
    () =>
      POSTO_ORDER.map((p, i) => ({
        name: p.label,
        value: (efetivoPorPosto[p.key] as number) ?? 0,
        color: PALETTE[(i + 2) % PALETTE.length],
      })),
    [efetivoPorPosto],
  );

  const dadosEquipesDisponiveis: PontoValor[] = useMemo(() => {
    return ['A', 'B', 'C', 'D', 'E'].map((eq, i) => {
      const d = policiaisPorEquipe[eq] ?? { total: 0, afastados: 0, disponiveis: 0 };
      return {
        name: `Equipe ${eq}`,
        value: d.disponiveis,
        color: PALETTE[i % PALETTE.length],
      };
    });
  }, [policiaisPorEquipe]);

  const linhasOperacional = useMemo(() => {
    const rows: { name: string; total: number; afastados: number; disponiveis: number }[] = [];
    if (!usuarioEhCpmulher && expedienteData) {
      rows.push({
        name: 'Expediente',
        total: expedienteData.total,
        afastados: expedienteData.afastados,
        disponiveis: expedienteData.disponiveis,
      });
    }
    if (!usuarioEhCpmulher && motoristasData) {
      rows.push({
        name: `Motoristas (${ESCALA_MOTORISTA_DIA})`,
        total: motoristasData.total,
        afastados: motoristasData.afastados,
        disponiveis: motoristasData.disponiveis,
      });
    }
    if (copomMulherData) {
      rows.push({
        name: 'COPOM Mulher',
        total: copomMulherData.total,
        afastados: copomMulherData.afastados,
        disponiveis: copomMulherData.disponiveis,
      });
    }
    return rows;
  }, [expedienteData, motoristasData, copomMulherData, usuarioEhCpmulher]);

  const piesOperacional = useMemo(() => {
    const items: { titulo: string; fatias: { name: string; value: number }[] }[] = [];
    if (!usuarioEhCpmulher && expedienteData) {
      items.push({
        titulo: 'Expediente',
        fatias: [
          { name: 'Total', value: expedienteData.total },
          { name: 'Afastados', value: expedienteData.afastados },
          { name: 'Disponíveis', value: expedienteData.disponiveis },
        ],
      });
    }
    if (!usuarioEhCpmulher && motoristasData) {
      items.push({
        titulo: `Motoristas (${ESCALA_MOTORISTA_DIA})`,
        fatias: [
          { name: 'Total', value: motoristasData.total },
          { name: 'Afastados', value: motoristasData.afastados },
          { name: 'Disponíveis', value: motoristasData.disponiveis },
        ],
      });
    }
    if (copomMulherData) {
      items.push({
        titulo: 'COPOM Mulher',
        fatias: [
          { name: 'Total', value: copomMulherData.total },
          { name: 'Afastados', value: copomMulherData.afastados },
          { name: 'Disponíveis', value: copomMulherData.disponiveis },
        ],
      });
    }
    return items;
  }, [expedienteData, motoristasData, copomMulherData, usuarioEhCpmulher]);

  const carregando = loadingAfastamentos && loadingPoliciais;

  return (
    <Box
      id="dashboard-panel-graficos"
      role="tabpanel"
      aria-labelledby="dashboard-tab-graficos"
      sx={{ py: 2, px: { xs: 0, sm: 1 } }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Período: <strong>{periodoLabel}</strong> — mesmos números da aba Cards.
        </Typography>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="dashboard-tipo-grafico-label">Tipo de gráfico</InputLabel>
          <Select
            labelId="dashboard-tipo-grafico-label"
            id="dashboard-tipo-grafico"
            label="Tipo de gráfico"
            value={tipoGrafico}
            onChange={(e) => onTipoGraficoChange(e.target.value as TipoGraficoDashboard)}
          >
            <MenuItem value="bar">Barras</MenuItem>
            <MenuItem value="pie">Pizza</MenuItem>
            <MenuItem value="line">Linha</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {carregando && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={36} />
        </Box>
      )}

      {!carregando && (
        <>
          <SecaoGrafico titulo="Indicadores do mês (afastados, disponíveis, férias, abono)">
            <ChartSimples tipo={tipoGrafico} data={dadosIndicadoresMes} />
          </SecaoGrafico>

          <SecaoGrafico titulo="Efetivo do COPOM por status">
            <ChartSimples tipo={tipoGrafico} data={dadosEfetivoStatus} />
          </SecaoGrafico>

          <SecaoGrafico titulo="Efetivo por posto / graduação">
            <ChartSimples tipo={tipoGrafico} data={dadosEfetivoPosto} />
          </SecaoGrafico>

          <SecaoGrafico titulo="Equipes operacionais — policiais disponíveis">
            <ChartSimples tipo={tipoGrafico} data={dadosEquipesDisponiveis} />
          </SecaoGrafico>

          {linhasOperacional.length > 0 && (
            <SecaoGrafico
              titulo={`Expediente, motoristas (${ESCALA_MOTORISTA_DIA}) e COPOM Mulher (total, afastados, disponíveis)`}
            >
              {tipoGrafico === 'bar' && <ChartOperacionalBarras rows={linhasOperacional} />}
              {tipoGrafico === 'line' && <ChartOperacionalLinhas rows={linhasOperacional} />}
              {tipoGrafico === 'pie' && <MiniPies items={piesOperacional} />}
            </SecaoGrafico>
          )}
        </>
      )}
    </Box>
  );
}
