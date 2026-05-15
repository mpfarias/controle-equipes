import type { ChamadaXlsxRow } from '../types/chamadasXlsx';
import type { RamalAbandonadasTop } from './agregarChamadasPorHora';
import {
  classificarStatusParaGraficoChamada,
  normalizarRamalChamada,
  ramalComMaisAbandonadasDoMap,
} from './agregarChamadasPorHora';
import { horarioParaHHMMSS } from './formatChamadaHorario';
import { obterLimitesTimestampsChamadas, parseDataHoraChamada, resumoPeriodoDatasChamadas } from './periodoDatasChamadas';

const CAMPOS_HORARIO: (keyof ChamadaXlsxRow)[] = ['horaEntradaFila', 'horaAtendimento', 'horaDesligamento'];

const MES_ABREV = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
] as const;

export type PontoChamadasLinhaTempo = {
  /** Início do intervalo de 30 min (ms). Usado como eixo X numérico no Recharts. */
  bucketMs: number;
  horaLabel: string;
  atendidas: number;
  abandonadas: number;
  abandonadasRamalTop?: RamalAbandonadasTop;
};

export type FaixaTurnoMetrica = 'madrugada' | 'diurno' | 'noturno';

export type MetricaFaixaDiaChamadas = {
  id: string;
  dataRefMs: number;
  dataLabelCurta: string;
  faixa: FaixaTurnoMetrica;
  faixaTitulo: string;
  faixaSub: string;
  atendidas: number;
  abandonadas: number;
  total: number;
  /** % de atendidas sobre (atendidas + abandonadas) na faixa; null se total = 0. */
  pctAtendidas: number | null;
};

export type LinhaTempoChamadasResult = {
  pontos: PontoChamadasLinhaTempo[];
  metricasFaixas: MetricaFaixaDiaChamadas[];
  textoPeriodoRodape: string;
  minInstante: Date;
  maxInstante: Date;
  /** true se alguma linha usou só hora (sem data) com o dia-base do primeiro carimbo. */
  usouFallbackSomenteHora: boolean;
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Início do intervalo de 30 minutos que contém `d` (:00 ou :30). */
function startOfHalfHour(d: Date): Date {
  const x = new Date(d);
  x.setSeconds(0, 0);
  const m = x.getMinutes();
  if (m < 30) x.setMinutes(0, 0, 0);
  else x.setMinutes(30, 0, 0);
  return x;
}

function formatDiaAbrev(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd} ${MES_ABREV[d.getMonth()]}`;
}

function labelHoraNoEixo(bucket: Date, incluirDia: boolean): string {
  const hh = String(bucket.getHours()).padStart(2, '0');
  const mm = String(bucket.getMinutes()).padStart(2, '0');
  const hora = `${hh}:${mm}`;
  if (!incluirDia) return hora;
  return `${formatDiaAbrev(bucket)}\n${hora}`;
}

/**
 * Prioridade: Hora Entrada Fila → Atendimento → Desligamento.
 * Se não houver data completa em nenhum campo, usa `diaBaseLocal` + horário (só hora).
 */
function instanteReferenciaLinha(
  row: ChamadaXlsxRow,
  diaBaseLocal: Date,
): { t: Date; teveDataCompleta: boolean } | null {
  for (const campo of CAMPOS_HORARIO) {
    const d = parseDataHoraChamada(row[campo]);
    if (d) return { t: d, teveDataCompleta: true };
  }
  const base = startOfLocalDay(diaBaseLocal);
  for (const campo of CAMPOS_HORARIO) {
    const t = horarioParaHHMMSS(row[campo]);
    if (!t) continue;
    const parts = t.split(':').map((p) => parseInt(p, 10));
    if (parts.length < 2 || Number.isNaN(parts[0])) continue;
    const out = new Date(base);
    out.setHours(parts[0], parts[1] ?? 0, parts[2] ?? 0, 0);
    return { t: out, teveDataCompleta: false };
  }
  return null;
}

function enumerateHalfHoursInclusive(min: Date, max: Date): Date[] {
  const start = startOfHalfHour(min);
  const end = startOfHalfHour(max);
  const out: Date[] = [];
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    out.push(new Date(cur));
    cur.setTime(cur.getTime() + 30 * 60 * 1000);
  }
  return out;
}

function addDaysLocal(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function diasCalendarioEntre(min: Date, max: Date): Date[] {
  const out: Date[] = [];
  let d = startOfLocalDay(min);
  const fim = startOfLocalDay(max);
  while (d.getTime() <= fim.getTime()) {
    out.push(new Date(d));
    d = addDaysLocal(d, 1);
  }
  return out;
}

const FAIXA_DEF: Record<
  FaixaTurnoMetrica,
  { titulo: string; sub: string; inicioH: number; fimH: number }
> = {
  madrugada: { titulo: 'Madrugada', sub: '00h às 06:59min', inicioH: 0, fimH: 7 },
  diurno: { titulo: 'Diurno', sub: '07h às 18:59min', inicioH: 7, fimH: 19 },
  noturno: { titulo: 'Noturno', sub: '19h às 23:59min', inicioH: 19, fimH: 24 },
};

function instanteNaFaixaDoDia(t: Date, diaInicio: Date, faixa: FaixaTurnoMetrica): boolean {
  if (startOfLocalDay(t).getTime() !== diaInicio.getTime()) return false;
  const def = FAIXA_DEF[faixa];
  const h = t.getHours() + t.getMinutes() / 60 + t.getSeconds() / 3600;
  return h >= def.inicioH && h < def.fimH;
}

/**
 * Agrega atendidas/abandonadas por **intervalos de 30 minutos** (:00 e :30) em todo o intervalo do arquivo,
 * cartões de % por dia e faixa (madrugada / diurno / noturno).
 * Requer ao menos um carimbo com **data** em alguma linha (`obterLimitesTimestampsChamadas`).
 */
export function agregarChamadasLinhaTempo(rows: ChamadaXlsxRow[]): LinhaTempoChamadasResult | null {
  const limites = obterLimitesTimestampsChamadas(rows);
  if (!limites) return null;

  const diaBaseFallback = startOfLocalDay(limites.min);
  let gMin = Infinity;
  let gMax = -Infinity;
  let usouFallbackSomenteHora = false;

  for (const row of rows) {
    const inst = instanteReferenciaLinha(row, diaBaseFallback);
    if (!inst) continue;
    if (!inst.teveDataCompleta) usouFallbackSomenteHora = true;
    const ms = inst.t.getTime();
    gMin = Math.min(gMin, ms);
    gMax = Math.max(gMax, ms);
  }

  if (!Number.isFinite(gMin) || !Number.isFinite(gMax)) return null;

  const minInstante = new Date(gMin);
  const maxInstante = new Date(gMax);
  const buckets = enumerateHalfHoursInclusive(minInstante, maxInstante);
  const bucketKey = (d: Date) => String(d.getTime());
  const map = new Map<string, { atendidas: number; abandonadas: number }>();
  const ramalPorBucket = new Map<string, Map<string, number>>();
  for (const b of buckets) {
    const k = bucketKey(b);
    map.set(k, { atendidas: 0, abandonadas: 0 });
    ramalPorBucket.set(k, new Map());
  }

  for (const row of rows) {
    const inst = instanteReferenciaLinha(row, diaBaseFallback);
    if (!inst) continue;
    const tipo = classificarStatusParaGraficoChamada(row.status);
    if (!tipo) continue;
    const bk = bucketKey(startOfHalfHour(inst.t));
    const cell = map.get(bk);
    if (!cell) continue;
    if (tipo === 'atendida') cell.atendidas += 1;
    else {
      cell.abandonadas += 1;
      const inner = ramalPorBucket.get(bk);
      if (inner) {
        const r = normalizarRamalChamada(row.ramal);
        inner.set(r, (inner.get(r) ?? 0) + 1);
      }
    }
  }

  const spanMs = maxInstante.getTime() - minInstante.getTime();
  const multiDia = spanMs > 36 * 3600000 || startOfLocalDay(minInstante).getTime() !== startOfLocalDay(maxInstante).getTime();

  const pontos: PontoChamadasLinhaTempo[] = buckets.map((b) => {
    const k = bucketKey(b);
    const c = map.get(k)!;
    const inner = ramalPorBucket.get(k);
    const top = c.abandonadas > 0 && inner ? ramalComMaisAbandonadasDoMap(inner) : null;
    const base: PontoChamadasLinhaTempo = {
      bucketMs: b.getTime(),
      horaLabel: labelHoraNoEixo(b, multiDia || buckets.length > 48),
      atendidas: c.atendidas,
      abandonadas: c.abandonadas,
    };
    return top ? { ...base, abandonadasRamalTop: top } : base;
  });

  const dias = diasCalendarioEntre(minInstante, maxInstante);
  const faixasOrdem: FaixaTurnoMetrica[] = ['madrugada', 'diurno', 'noturno'];
  const metricasFaixas: MetricaFaixaDiaChamadas[] = [];

  for (const dia of dias) {
    for (const faixa of faixasOrdem) {
      const def = FAIXA_DEF[faixa];
      let at = 0;
      let ab = 0;
      for (const row of rows) {
        const inst = instanteReferenciaLinha(row, diaBaseFallback);
        if (!inst) continue;
        if (!instanteNaFaixaDoDia(inst.t, dia, faixa)) continue;
        const tipo = classificarStatusParaGraficoChamada(row.status);
        if (tipo === 'atendida') at += 1;
        else if (tipo === 'abandonada') ab += 1;
      }
      const total = at + ab;
      const pctAtendidas = total > 0 ? Math.round((100 * at) / total) : null;
      const id = `${dia.getFullYear()}-${dia.getMonth()}-${dia.getDate()}-${faixa}`;
      metricasFaixas.push({
        id,
        dataRefMs: dia.getTime(),
        dataLabelCurta: formatDiaAbrev(dia),
        faixa,
        faixaTitulo: def.titulo,
        faixaSub: def.sub,
        atendidas: at,
        abandonadas: ab,
        total,
        pctAtendidas,
      });
    }
  }

  const { textoPeriodo, identificado } = resumoPeriodoDatasChamadas(rows);
  const textoPeriodoRodape =
    identificado && textoPeriodo
      ? textoPeriodo
      : `${minInstante.toLocaleString('pt-BR')} — ${maxInstante.toLocaleString('pt-BR')}`;

  return {
    pontos,
    metricasFaixas,
    textoPeriodoRodape,
    minInstante,
    maxInstante,
    usouFallbackSomenteHora,
  };
}

/** Proporções da barra de contexto (24h): madrugada 7h, diurno 12h, noturno 5h. */
export const PROPORCAO_FAIXA_24H = { madrugada: 7, diurno: 12, noturno: 5 } as const;

export const CORES_FAIXA_BARRA = {
  madrugada: '#93c5fd',
  diurno: '#fb923c',
  noturno: '#1e40af',
} as const;
