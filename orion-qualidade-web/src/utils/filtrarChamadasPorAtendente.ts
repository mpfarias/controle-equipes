import type { ChamadaXlsxRow } from '../types/chamadasXlsx';
import { formatarNomeTitulo } from './formatNomeTitulo';
import { parseDataHoraChamada } from './periodoDatasChamadas';

export function nomeAtendenteDaLinha(row: ChamadaXlsxRow): string {
  const bruto = row.atendente?.trim() ? row.atendente.trim() : '';
  return bruto ? formatarNomeTitulo(bruto) : '(Não informado)';
}

export function filtrarChamadasPorAtendente(rows: ChamadaXlsxRow[], nomeAtendente: string): ChamadaXlsxRow[] {
  return rows
    .filter((row) => nomeAtendenteDaLinha(row) === nomeAtendente)
    .sort((a, b) => {
      const ta = parseDataHoraChamada(a.horaEntradaFila)?.getTime() ?? 0;
      const tb = parseDataHoraChamada(b.horaEntradaFila)?.getTime() ?? 0;
      return ta - tb || a.id.localeCompare(b.id, 'pt-BR');
    });
}
