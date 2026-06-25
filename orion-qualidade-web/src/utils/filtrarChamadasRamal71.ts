import type { ChamadaXlsxRow } from '../types/chamadasXlsx';

const PREFIXO = '71';

export function ramalAtendeFiltroQualidade(ramal: string | null | undefined): boolean {
  const t = String(ramal ?? '').trim();
  return t.length > 0 && t.startsWith(PREFIXO);
}

export function filtrarChamadasRamal71(rows: ChamadaXlsxRow[]): ChamadaXlsxRow[] {
  return rows.filter((row) => ramalAtendeFiltroQualidade(row.ramal));
}
