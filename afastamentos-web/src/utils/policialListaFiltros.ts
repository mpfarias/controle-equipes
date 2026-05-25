import { funcaoOcultaCampoEquipe } from '../constants';
import type { Equipe, FuncaoOption, Policial, PolicialStatus } from '../types';

export type FiltrosListaPoliciais = {
  usuarioPodeVerTodos: boolean;
  usuarioEhCpmulher: boolean;
  equipeAtual: string | null | undefined;
  equipesSelecionadas: Equipe[];
  statusSelecionados: PolicialStatus[];
  funcoesSelecionadas: number[];
  funcoesCpmulherIds: number[];
  excluirMotoristas: boolean;
  excluirDesativados: boolean;
  somenteComRestricaoMedica: boolean;
};

/** Indica se o policial deve aparecer na lista da Mostrar Equipe com os filtros atuais. */
export function policialPassaFiltrosListaMostrarEquipe(
  policial: Policial,
  opcoes: FiltrosListaPoliciais,
): boolean {
  const {
    usuarioPodeVerTodos,
    usuarioEhCpmulher,
    equipeAtual,
    equipesSelecionadas,
    statusSelecionados,
    funcoesSelecionadas,
    funcoesCpmulherIds,
    excluirMotoristas,
    excluirDesativados,
    somenteComRestricaoMedica,
  } = opcoes;

  if (!usuarioPodeVerTodos && !usuarioEhCpmulher) {
    if (policial.equipe !== equipeAtual) return false;
  }

  if (usuarioEhCpmulher && funcoesCpmulherIds.length > 0) {
    if (!policial.funcaoId || !funcoesCpmulherIds.includes(policial.funcaoId)) return false;
  }

  if (equipesSelecionadas.length > 0) {
    if (!policial.equipe || !equipesSelecionadas.includes(policial.equipe)) return false;
  }

  if (statusSelecionados.length > 0) {
    if (!policial.status || !statusSelecionados.includes(policial.status)) return false;
  }

  if (funcoesSelecionadas.length > 0) {
    if (!policial.funcaoId || !funcoesSelecionadas.includes(policial.funcaoId)) return false;
  }

  if (excluirMotoristas) {
    const nomeFuncao = policial.funcao?.nome?.toUpperCase() ?? '';
    if (nomeFuncao.includes('MOTORISTA DE DIA')) return false;
  }

  if (excluirDesativados && policial.status === 'DESATIVADO') return false;

  if (somenteComRestricaoMedica && policial.restricaoMedicaId == null) return false;

  return true;
}

export function motivoPolicialForaDaLista(
  policial: Policial,
  opcoes: FiltrosListaPoliciais,
): string | null {
  if (policialPassaFiltrosListaMostrarEquipe(policial, opcoes)) return null;

  if (!opcoes.usuarioPodeVerTodos && !opcoes.usuarioEhCpmulher && policial.equipe !== opcoes.equipeAtual) {
    return policial.equipe
      ? `equipe ${policial.equipe} (sua visão é da equipe ${opcoes.equipeAtual ?? '—'})`
      : 'sem equipe (sua lista mostra só a sua equipe)';
  }
  if (opcoes.excluirDesativados && policial.status === 'DESATIVADO') {
    return 'status desativado (filtro “Excluir desativados” ativo)';
  }
  if (opcoes.excluirMotoristas && policial.funcao?.nome?.toUpperCase().includes('MOTORISTA DE DIA')) {
    return 'função motorista de dia (filtro “Excluir motoristas” ativo)';
  }
  if (opcoes.equipesSelecionadas.length > 0 && (!policial.equipe || !opcoes.equipesSelecionadas.includes(policial.equipe))) {
    return 'equipe fora do filtro selecionado';
  }
  if (opcoes.statusSelecionados.length > 0 && !opcoes.statusSelecionados.includes(policial.status)) {
    return 'status fora do filtro selecionado';
  }
  if (opcoes.funcoesSelecionadas.length > 0 && (!policial.funcaoId || !opcoes.funcoesSelecionadas.includes(policial.funcaoId))) {
    return 'função fora do filtro selecionado';
  }
  if (opcoes.somenteComRestricaoMedica && policial.restricaoMedicaId == null) {
    return 'sem restrição médica (filtro ativo)';
  }
  return 'filtros atuais da lista';
}

/** Evita zerar equipe no PATCH quando só posto/quadro/nome mudou e a função não usa equipe no formulário. */
export function equipeParaPayloadEdicaoPolicial(
  editingPolicial: Policial,
  editForm: { funcaoId?: number; equipe?: Equipe },
  funcoes: FuncaoOption[],
  equipeResolvida: Equipe | null,
): Equipe | null | undefined {
  const funcaoIdAnterior = editingPolicial.funcaoId ?? editingPolicial.funcao?.id ?? undefined;
  const funcaoIdChanged =
    editForm.funcaoId !== undefined && editForm.funcaoId !== funcaoIdAnterior;
  const funcaoSel = editForm.funcaoId ? funcoes.find((f) => f.id === editForm.funcaoId) : undefined;

  if (funcaoIdChanged) {
    return equipeResolvida;
  }
  if (funcaoOcultaCampoEquipe(funcaoSel)) {
    return undefined;
  }
  return equipeResolvida;
}
