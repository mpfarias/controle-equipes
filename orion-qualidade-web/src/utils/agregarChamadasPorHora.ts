import type { ChamadaXlsxRow } from '../types/chamadasXlsx';
import { horarioParaHHMMSS } from './formatChamadaHorario';

/** Ramal com maior número de abandonadas na hora (empate: menor rótulo lexicográfico). */
export type RamalAbandonadasTop = { ramal: string; quantidade: number };

export type PontoChamadasPorHora = {
  horaLabel: string;
  horaIndex: number;
  atendidas: number;
  abandonadas: number;
  /** Preenchido quando `abandonadas` &gt; 0: ramal que mais concentrou abandonos naquela hora. */
  abandonadasRamalTop?: RamalAbandonadasTop;
};

/** Texto do ramal para agregação (vazio → «Sem ramal»). */
export function normalizarRamalChamada(ramal: string): string {
  const t = ramal.trim();
  return t.length > 0 ? t : '(Sem ramal)';
}

export function ramalComMaisAbandonadasDoMap(contagemPorRamal: Map<string, number>): RamalAbandonadasTop | null {
  let best: RamalAbandonadasTop | null = null;
  for (const [ramal, q] of contagemPorRamal) {
    if (q <= 0) continue;
    if (
      best === null ||
      q > best.quantidade ||
      (q === best.quantidade && ramal.localeCompare(best.ramal, 'pt-BR') < 0)
    ) {
      best = { ramal, quantidade: q };
    }
  }
  return best;
}

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
  const ramalPorHora: Map<string, number>[] = Array.from({ length: 24 }, () => new Map());
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
    if (tipo === 'atendida') {
      buckets[h].atendidas += 1;
    } else {
      buckets[h].abandonadas += 1;
      const r = normalizarRamalChamada(row.ramal);
      const m = ramalPorHora[h];
      m.set(r, (m.get(r) ?? 0) + 1);
    }
  }

  for (let h = 0; h < 24; h++) {
    if (buckets[h].abandonadas > 0) {
      const top = ramalComMaisAbandonadasDoMap(ramalPorHora[h]);
      if (top) {
        buckets[h].abandonadasRamalTop = top;
      }
    }
  }

  return buckets;
}
