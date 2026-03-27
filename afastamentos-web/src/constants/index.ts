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

/** Aba geral "Afastamentos" - agrupa as telas relacionadas. */
export type AfastamentosSubTabKey = 'afastamentos-mes' | 'afastamentos' | 'restricao-afastamento';

/** Aba geral "Efetivo" - agrupa as telas relacionadas. */
export type EfetivoSubTabKey = 'equipe' | 'policiais';

/** Aba geral "Sistema" - agrupa as telas relacionadas. */
export type SistemaSubTabKey = 'usuarios' | 'gestao-sistema' | 'relatorios';

export type TabChangeOptions = {
  preencherCadastro?: { policialId: number; motivoNome: string };
  /** Sub-tab a abrir ao navegar para a aba Afastamentos. */
  subTab?: AfastamentosSubTabKey;
};

export type TabKey =
  | 'dashboard'
  | 'afastamentos'
  | 'calendario'
  /** Legado: uma única chave para toda a área Escalas (ainda pode existir no banco até regravar permissões). */
  | 'escalas'
  /** Gerar e gravar escalas (aba Gerar). */
  | 'escalas-gerar'
  /** Consultar / imprimir escalas salvas (aba Visualizar). */
  | 'escalas-consultar'
  /** Registrar e gerenciar trocas de serviço (Efetivo + área de trocas em Escalas). */
  | 'troca-servico'
  | 'sistema'
  | 'afastamentos-mes'
  | 'policiais'
  | 'equipe'
  | 'usuarios'
  | 'relatorios'
  | 'relatorios-sistema'
  | 'relatorios-servico'
  | 'restricao-afastamento'
  | 'gestao-sistema';

export const AFastamentosSubTABS: { key: AfastamentosSubTabKey; label: string }[] = [
  { key: 'afastamentos', label: 'Gerenciar afastamentos' },
  { key: 'afastamentos-mes', label: 'Afastamentos do mês' },
  { key: 'restricao-afastamento', label: 'Gerar restrição de afastamento' },
];

export const EfetivoSubTABS: { key: EfetivoSubTabKey; label: string }[] = [
  { key: 'equipe', label: 'Efetivo' },
  { key: 'policiais', label: 'Cadastrar Policial' },
];

export const SistemaSubTABS: { key: SistemaSubTabKey; label: string }[] = [
  { key: 'usuarios', label: 'Cadastrar usuários' },
  { key: 'gestao-sistema', label: 'Gestão do Sistema' },
  { key: 'relatorios', label: 'Relatórios' },
];

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'calendario', label: 'Calendário das Equipes' },
  { key: 'escalas', label: 'Escalas' },
  { key: 'afastamentos', label: 'Afastamentos' },
  { key: 'equipe', label: 'Efetivo' },
  { key: 'sistema', label: 'Sistema' },
];

/** Telas usadas na configuração de permissões (Gestão do Sistema). Mantém as sub-telas de Afastamentos para controle granular. */
export const PERMISSION_TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'afastamentos-mes', label: 'Afastamentos do mês' },
  { key: 'restricao-afastamento', label: 'Gerar restrição de afastamento' },
  { key: 'afastamentos', label: 'Gerenciar afastamentos' },
  { key: 'policiais', label: 'Cadastrar Policial' },
  { key: 'usuarios', label: 'Cadastrar usuários' },
  { key: 'calendario', label: 'Calendário das Equipes' },
  { key: 'escalas-gerar', label: 'Escalas – Gerar' },
  { key: 'escalas-consultar', label: 'Escalas – Consultar / imprimir' },
  { key: 'troca-servico', label: 'Troca de serviço' },
  { key: 'equipe', label: 'Efetivo' },
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
