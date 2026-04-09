import type { ChamadaXlsxRow } from '../types/chamadasXlsx';
import type { PontoChamadasPorHora } from './agregarChamadasPorHora';
import { horarioParaHHMMSS } from './formatChamadaHorario';

export type PeriodoTurnoChamada = 'diurno' | 'noturno';

const CAMPOS_HORA_REF: (keyof ChamadaXlsxRow)[] = ['horaEntradaFila', 'horaAtendimento', 'horaDesligamento'];

/** Minutos desde 00:00 (0–1439), ou null se não houver horário válido. */
function minutosDesdeMeiaNoite(raw: string): number | null {
  const t = horarioParaHHMMSS(raw);
  if (!t) return null;
  const parts = t.split(':').map((p) => parseInt(p, 10));
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  const h = parts[0];
  const m = parts[1];
  const s = parts[2] ?? 0;
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
  return h * 60 + m;
}

function minutosReferenciaLinha(row: ChamadaXlsxRow): number | null {
  for (const campo of CAMPOS_HORA_REF) {
    const mm = minutosDesdeMeiaNoite(row[campo]);
    if (mm !== null) return mm;
  }
  return null;
}

/**
 * Diurno: 07:00 até 18:59.
 * Noturno: 19:00 até 06:59 (cruza meia-noite).
 * Mesma ordem de campos que os gráficos (entrada fila → atendimento → desligamento).
 */
export function periodoTurnoDaChamada(row: ChamadaXlsxRow): PeriodoTurnoChamada | null {
  const t = minutosReferenciaLinha(row);
  if (t === null) return null;
  const iniDiurno = 7 * 60;
  const fimDiurno = 18 * 60 + 59;
  if (t >= iniDiurno && t <= fimDiurno) return 'diurno';
  if (t >= 19 * 60 || t <= 6 * 60 + 59) return 'noturno';
  return null;
}

export function filtrarChamadasPorTurno(
  rows: ChamadaXlsxRow[],
  turno: PeriodoTurnoChamada,
): ChamadaXlsxRow[] {
  return rows.filter((r) => periodoTurnoDaChamada(r) === turno);
}

/** Horas exibidas no eixo X do gráfico de linhas (ordem lógica). */
export const HORAS_ORDEM_DIURNO = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;
export const HORAS_ORDEM_NOTURNO = [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6] as const;

export function fatiarPontosPorTurno(buckets24: PontoChamadasPorHora[], turno: PeriodoTurnoChamada): PontoChamadasPorHora[] {
  const ordem = turno === 'diurno' ? HORAS_ORDEM_DIURNO : HORAS_ORDEM_NOTURNO;
  const map = new Map(buckets24.map((p) => [p.horaIndex, p]));
  return ordem.map((h) => {
    const p = map.get(h);
    if (p) return p;
    return {
      horaLabel: `${String(h).padStart(2, '0')}:00`,
      horaIndex: h,
      atendidas: 0,
      abandonadas: 0,
    };
  });
}
