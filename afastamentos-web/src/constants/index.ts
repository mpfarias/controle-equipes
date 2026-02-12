import type { AfastamentoStatus, PolicialStatus } from '../types';
import type { FuncaoOption } from '../types';

/** Nome da função que não pode mais ser usada; filtrada das listas de seleção. */
export const FUNCAO_NAO_INFORMADO_NOME = 'NÃO INFORMADO';

/** Remove a função "NÃO INFORMADO" da lista (não deve ser selecionável). */
export function funcoesParaSelecao(funcoes: FuncaoOption[]): FuncaoOption[] {
  return funcoes.filter(
    (f) => f.nome.toUpperCase().trim() !== FUNCAO_NAO_INFORMADO_NOME,
  );
}

export type TabChangeOptions = {
  preencherCadastro?: { policialId: number; motivoNome: string };
};

export type TabKey =
  | 'dashboard'
  | 'calendario'
  | 'afastamentos-mes'
  | 'afastamentos'
  | 'policiais'
  | 'equipe'
  | 'usuarios'
  | 'relatorios'
  | 'relatorios-sistema'
  | 'relatorios-servico'
  | 'restricao-afastamento'
  | 'gestao-sistema';

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'calendario', label: 'Calendário das Equipes' },
  { key: 'afastamentos-mes', label: 'Afastamentos do mês' },
  { key: 'afastamentos', label: 'Gerenciar afastamentos' },
  { key: 'restricao-afastamento', label: 'Gerar restrição de afastamento' },
  { key: 'policiais', label: 'Cadastrar Policial' },
  { key: 'equipe', label: 'Gerenciar Efetivo' },
  { key: 'usuarios', label: 'Cadastrar usuários' },
  { key: 'gestao-sistema', label: 'Gestão do Sistema' },
  { key: 'relatorios', label: 'Relatórios' },
];

export const STATUS_LABEL: Record<AfastamentoStatus, string> = {
  ATIVO: 'Ativo',
  ENCERRADO: 'Encerrado',
};

export const POLICIAL_STATUS_OPTIONS: { value: PolicialStatus; label: string }[] = [
  { value: 'ATIVO', label: 'Ativo' },
  { value: 'DESIGNADO', label: 'Designado' },
  { value: 'COMISSIONADO', label: 'Comissionado' },
  { value: 'PTTC', label: 'PTTC' },
  { value: 'DESATIVADO', label: 'Desativado' },
];

/** Opções de status para formulários (cadastro/edição). Não inclui Desativado – policial só é desativado/ativado pelo botão na lista. */
export const POLICIAL_STATUS_OPTIONS_FORM: { value: PolicialStatus; label: string }[] =
  POLICIAL_STATUS_OPTIONS.filter((o) => o.value !== 'DESATIVADO');

export const formatEquipeLabel = (equipe?: string | null) => {
  if (!equipe) {
    return '—';
  }
  return equipe;
};
