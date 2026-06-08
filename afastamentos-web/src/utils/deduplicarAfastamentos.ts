import type { Afastamento } from '../types';

const TZ = 'America/Sao_Paulo';

function dataCivilSp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Chave de negócio para detectar o mesmo lançamento exibido duas vezes. */
export function chaveAfastamentoLista(a: Afastamento): string {
  const fim = a.dataFim ? dataCivilSp(a.dataFim) : '';
  return `${a.policialId}|${a.motivoId}|${dataCivilSp(a.dataInicio)}|${fim}|${a.seiNumero.trim()}`;
}

/**
 * Remove duplicatas na lista (mesmo id ou mesmo policial/motivo/período/SEI).
 * Mantém o primeiro registro (API ordena por dataInicio desc).
 */
export function deduplicarAfastamentosLista(afastamentos: Afastamento[]): Afastamento[] {
  const ids = new Set<number>();
  const chaves = new Set<string>();
  const saida: Afastamento[] = [];

  for (const item of afastamentos) {
    if (ids.has(item.id)) continue;
    const chave = chaveAfastamentoLista(item);
    if (chaves.has(chave)) continue;
    ids.add(item.id);
    chaves.add(chave);
    saida.push(item);
  }

  return saida;
}
