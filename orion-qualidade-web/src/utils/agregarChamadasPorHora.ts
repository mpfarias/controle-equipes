import type { ChamadaXlsxRow } from '../types/chamadasXlsx';
import { horarioParaHHMMSS } from './formatChamadaHorario';

export type PontoChamadasPorHora = {
  horaLabel: string;
  horaIndex: number;
  atendidas: number;
  abandonadas: number;
};

function extrairHora0a23DeCampo(raw: string): number | null {
  const t = horarioParaHHMMSS(raw);
  if (!t) return null;
  const [hh] = t.split(':');
  const h = parseInt(hh, 10);
  if (Number.isNaN(h) || h < 0 || h > 23) return null;
  return h;
}

/** Hora do intervalo fechado: prioriza Hora Entrada Fila, depois Atendimento e Desligamento. */
function horaIntervaloFechadoDaLinha(row: ChamadaXlsxRow): number | null {
  for (const campo of ['horaEntradaFila', 'horaAtendimento', 'horaDesligamento'] as const) {
    const h = extrairHora0a23DeCampo(row[campo]);
    if (h !== null) return h;
  }
  return null;
}

/**
 * Considera apenas linhas com status ATENDIDA ou ABANDONADA (variações comuns no export).
 * Evita contar "NÃO ATENDIDA" como atendida.
 */
export function classificarStatusParaGraficoChamada(status: string): 'atendida' | 'abandonada' | null {
  const s = status.trim().toUpperCase().normalize('NFC').replace(/\s+/g, ' ');
  if (!s) return null;
  if (s.includes('ABANDON')) return 'abandonada';
  if (/\bNAO\b.*ATEND|\bNÃO\b.*ATEND/.test(s)) return null;
  if (s.includes('ATENDIDA') || s.includes('ATENDIDO')) return 'atendida';
  return null;
}

export function agregarChamadasAtendidasAbandonadasPorHora(rows: ChamadaXlsxRow[]): PontoChamadasPorHora[] {
  const buckets: PontoChamadasPorHora[] = Array.from({ length: 24 }, (_, h) => ({
    horaLabel: `${String(h).padStart(2, '0')}:00`,
    horaIndex: h,
    atendidas: 0,
    abandonadas: 0,
  }));

  for (const row of rows) {
    const tipo = classificarStatusParaGraficoChamada(row.status);
    if (!tipo) continue;
    const h = horaIntervaloFechadoDaLinha(row);
    if (h === null) continue;
    if (tipo === 'atendida') buckets[h].atendidas += 1;
    else buckets[h].abandonadas += 1;
  }

  return buckets;
}
