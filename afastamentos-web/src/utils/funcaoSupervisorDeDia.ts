import type { Policial, Usuario } from '../types';

/**
 * Função «Superior de dia»: não entra nas equipes operacionais nem em Órion Operações.
 * Entra na geração de escalas no bloco «Superior de dia» (rotação 12×24 por equipe).
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
