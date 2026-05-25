import { formatEquipeLabel } from '../constants';
import type { Policial } from '../types';
import { formatMatricula } from './dateUtils';

/** Normaliza texto para busca (sem acentos, minúsculas). */
export function normalizarTextoBusca(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function matriculaTextoBuscaPolicial(p: Policial): string {
  const raw =
    p.status === 'COMISSIONADO' && (p.matriculaComissionadoGdf ?? '').trim()
      ? (p.matriculaComissionadoGdf ?? '').trim()
      : p.matricula;
  return `${raw} ${formatMatricula(raw)}`;
}

export function haystackBuscaPolicial(p: Policial): string {
  return normalizarTextoBusca(
    `${p.nome} ${matriculaTextoBuscaPolicial(p)} ${p.postoGraduacao?.sigla ?? ''} ${p.funcao?.nome ?? ''} ${formatEquipeLabel(p.equipe)} ${p.status ?? ''}`,
  );
}

/** Verdadeiro se o termo de busca (com ou sem acento) casa com nome, matrícula, posto, função ou equipe. */
export function policialCorrespondeBusca(p: Policial, busca: string): boolean {
  const termo = normalizarTextoBusca(busca);
  if (!termo) return true;
  return haystackBuscaPolicial(p).includes(termo);
}

/** Rótulo exibido no Autocomplete de policial (padrão escalas / afastamentos). */
export function labelPolicialAutocomplete(p: Policial): string {
  const mat =
    p.status === 'COMISSIONADO' && (p.matriculaComissionadoGdf ?? '').trim()
      ? p.matriculaComissionadoGdf!.trim()
      : p.matricula;
  const st =
    p.status === 'DESIGNADO' ? 'Designado' : p.status === 'ATIVO' ? 'Ativo' : (p.status ?? '');
  return `${p.nome} — ${formatEquipeLabel(p.equipe)} · ${formatMatricula(mat)}${st ? ` · ${st}` : ''}`;
}

export function filtrarPoliciaisAutocomplete(
  options: Policial[],
  inputValue: string,
): Policial[] {
  const t = normalizarTextoBusca(inputValue);
  if (!t) return options;
  return options.filter((p) => haystackBuscaPolicial(p).includes(t));
}
