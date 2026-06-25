/** Tema visual premium / neon para gráficos do Dashboard. */
export const NEON = {
  panelBg: 'rgba(6, 14, 28, 0.92)',
  panelBorder: 'rgba(34, 211, 238, 0.28)',
  panelGlow: '0 0 24px rgba(34, 211, 238, 0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
  gridStroke: 'rgba(148, 163, 184, 0.12)',
  axis: '#94a3b8',
  label: '#cbd5e1',
  muted: '#64748b',
  accent: '#FF7A1A',
  colors: {
    cyan: '#22d3ee',
    blue: '#60a5fa',
    indigo: '#818cf8',
    green: '#86C99E',
    amber: '#fbbf24',
    orange: '#fb923c',
    pink: '#f472b6',
    purple: '#c084fc',
    red: '#f87171',
    slate: '#94a3b8',
  },
  series: {
    total: '#94a3b8',
    afastados: '#fb923c',
    disponiveis: '#86C99E',
    ferias: '#fbbf24',
    abono: '#f472b6',
    restricao: '#f87171',
  },
} as const;

export const NEON_PALETTE = [
  NEON.colors.cyan,
  NEON.colors.blue,
  NEON.colors.green,
  NEON.colors.amber,
  NEON.colors.pink,
  NEON.colors.purple,
  NEON.colors.orange,
  NEON.colors.indigo,
];

export type TipoGraficoDashboard = 'bar' | 'pie' | 'line';

export type EquipeStats = { total: number; afastados: number; disponiveis: number };

export type RowEquipeChart = EquipeStats & { name: string };

export type UnidadeOperacionalStats = { total: number; afastados: number; disponiveis: number };

export type RestricoesMedicasStats = { total: number; esteMes: number; hoje: number };
