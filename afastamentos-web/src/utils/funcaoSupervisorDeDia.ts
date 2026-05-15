import type { Policial, Usuario } from '../types';

/**
 * Função «Superior de dia» (cadastro em Gestão): não participa de escalas nem de Órion Operações (ocorrências).
 * Critério: nome normalizado contém o trecho «superior de dia» (com ou sem sufixo após hífen/espaço).
 */
export function funcaoNomeIndicaSuperiorDeDia(nomeFuncao: string | null | undefined): boolean {
  const f = (nomeFuncao ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!f) return false;
  const compact = f.replace(/\s/g, '');
  return f.includes('SUPERIOR DE DIA') || compact.includes('SUPERIORDEDIA');
}

export function policialFuncaoBloqueiaEscalasEOperacoes(p: Policial): boolean {
  return funcaoNomeIndicaSuperiorDeDia(p.funcao?.nome);
}

export function usuarioFuncaoBloqueiaEscalasEOperacoes(u: Usuario | null | undefined): boolean {
  if (!u) return false;
  return funcaoNomeIndicaSuperiorDeDia(u.funcao?.nome);
}
