import type { Afastamento } from '../types';
import { afastamentoInterfereNasRegrasDoSistema } from './afastamentoRegrasBloqueio';

const TZ = 'America/Sao_Paulo';

function dataCivilSp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Chave de negócio para detectar o mesmo lançamento exibido duas vezes. */
export function chaveAfastamentoLista(a: Afastamento): string {
  const fim = a.dataFim ? dataCivilSp(a.dataFim) : '';
  return `${a.policialId}|${a.motivoId}|${dataCivilSp(a.dataInicio)}|${fim}|${a.seiNumero.trim()}`;
}

/** Remove duplicatas pelo id (mesmo registro repetido na resposta da API). */
export function deduplicarAfastamentosPorId(afastamentos: Afastamento[]): Afastamento[] {
  const ids = new Set<number>();
  const saida: Afastamento[] = [];

  for (const item of afastamentos) {
    if (ids.has(item.id)) continue;
    ids.add(item.id);
    saida.push(item);
  }

  return saida;
}

/**
 * Um lançamento lógico (mesma chave) só aparece uma vez na UI.
 * Prioridade: ATIVO → ENCERRADO (automático) → DESATIVADO.
 * Evita par ATIVO + DESATIVADO duplicado nas abas após desativar e recadastrar.
 */
export function deduplicarAfastamentosParaExibicao(afastamentos: Afastamento[]): Afastamento[] {
  const porId = deduplicarAfastamentosPorId(afastamentos);
  const grupos = new Map<string, Afastamento[]>();

  for (const item of porId) {
    const chave = chaveAfastamentoLista(item);
    const grupo = grupos.get(chave) ?? [];
    grupo.push(item);
    grupos.set(chave, grupo);
  }

  const escolherRepresentante = (grupo: Afastamento[]): Afastamento => {
    const ativo = grupo.find((a) => a.status === 'ATIVO');
    if (ativo) return ativo;

    const encerrado = grupo.find(
      (a) => a.status === 'ENCERRADO' && afastamentoInterfereNasRegrasDoSistema(a),
    );
    if (encerrado) return encerrado;

    const desativado = grupo.find((a) => a.status === 'DESATIVADO');
    if (desativado) return desativado;

    return grupo[0]!;
  };

  return [...grupos.values()].map(escolherRepresentante);
}

/** @deprecated Use deduplicarAfastamentosPorId ou deduplicarAfastamentosParaExibicao. */
export function deduplicarAfastamentosLista(afastamentos: Afastamento[]): Afastamento[] {
  return deduplicarAfastamentosParaExibicao(afastamentos);
}
