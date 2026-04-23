import type { AfastamentoStatus, PolicialStatus } from '../types';
import type { FuncaoOption } from '../types';

export {
  funcaoOcultaCampoEquipe,
  funcaoEquipeObrigatoriaNoFormulario,
  funcaoRequerFase12x36Expediente,
  resolveEquipeParaPolicial,
} from './funcaoVinculoEquipe';

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

/** Subáreas da aba Escalas (Gerar, escala extra, Visualizar, quantidade de extras). */
export type EscalasSubTabKey = 'gerar' | 'gerar-extra' | 'consultar' | 'quantitativo-extras';

/** Payload ao abrir «Gerenciar afastamentos» já com policial/motivo (ex.: dashboard). */
export type PreencherCadastroAfastamentoInput = {
  policialId: number;
  motivoNome: string;
  /** Ano da cota de férias (exercício), alinhado à previsão no dashboard. */
  anoExercicioFerias?: number;
};

export type TabChangeOptions = {
  preencherCadastro?: PreencherCadastroAfastamentoInput;
  /** Sub-tab a abrir ao navegar para a aba Afastamentos. */
  subTab?: AfastamentosSubTabKey;
  /** Sub-tab a abrir ao navegar para a aba Escalas (Gerar / escala extra / Visualizar / quantitativo). */
  escalasSubTab?: EscalasSubTabKey;
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
  /** Permissão granular (ex.: ver trocas em Escalas – Consultar); registrar troca é no Efetivo. */
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
  | 'gestao-sistema'
  /**
   * Chave legada / interna (não aparece em «Níveis de acesso»).
   * Acesso ao app Órion Qualidade vem só de `sistemasPermitidos` no cadastro do usuário.
   */
  | 'orion-qualidade'
  /** Suporte: abrir chamado técnico (visível a todos os perfis). */
  | 'reportar-erro';

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
  { key: 'reportar-erro', label: 'Reportar erro' },
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
  DESATIVADO: 'Desativado',
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
