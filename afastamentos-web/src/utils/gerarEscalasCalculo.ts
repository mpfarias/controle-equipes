import type {
  Afastamento,
  EscalaExtraordinariaTipoServico,
  FuncaoOption,
  Policial,
  PolicialStatus,
  TrocaServicoAtivaListaItem,
} from '../types';
import { ESCALA_MOTORISTA_DIA } from '../constants/escalaMotoristasDia';
import type { EscalaParsed } from './escalaParametros';
import { comparePorPatenteENome } from './sortPoliciais';
import { formatLinhaAssinaturaCmtUpm } from './formatUsuarioExibicao';
import {
  ESCALA_DIA_FIM,
  ESCALA_DIA_INICIO,
  ESCALA_NOITE_FIM,
  ESCALA_NOITE_INICIO,
  getExpedienteHorario,
} from '../constants/svgRegras';
import {
  blocoExpedienteParaPolicial,
  EXPEDIENTE_ESCALA_RESUMO_REGRAS,
  formatoRelogioUm,
  relogioParaLabel,
  resolverHorarioExpedientePolicial,
} from './expedienteEscalaRegras';
import { indiceOrdenacaoBloco, type BlocoEscalaId, type EscalaCabecalhoFormulario } from './escalaBlocos';
import { policialFuncaoBloqueiaEscalasEOperacoes } from './funcaoSupervisorDeDia';
import { policialPossuiRestricaoCadastrada } from './policialRestricao';
import { montarCandidatosSuperiorDeDia } from './superiorDeDiaEscala';
import {
  montarCandidatosSvgVoluntario,
  resumoSvgVoluntarioConfig,
  type SvgEscalaConfig,
} from './svgEscalaVoluntario';

export type TipoServicoGerar = 'OPERACIONAL' | 'EXPEDIENTE' | 'MOTORISTAS' | 'SVG';

export type { SvgEscalaConfig, SvgEscalaLinhaVoluntario } from './svgEscalaVoluntario';
export { calcularEquipeMotoristasDia, calcularEquipesOperacionalDia } from './escalaEquipesCalculo';

export type LinhaEscalaGeradaDraft = {
  lista: 'DISPONIVEL' | 'AFASTADO';
  policialId: number;
  nome: string;
  matricula: string;
  equipe: string | null;
  horarioServico: string;
  funcaoNome: string | null;
  detalheAfastamento: string | null;
  /** Classificação para impressão em blocos (não persistido na API). */
  tipoServicoLinha?: TipoServicoGerar;
  blocoEscala?: BlocoEscalaId;
  /** Critério de ordenação (listas do sistema); não enviado à API. */
  ordenacaoPolicialStatus?: PolicialStatus;
};

export type EscalaGeradaDraftPayload = {
  dataEscala: string;
  /** Um tipo (`OPERACIONAL`) ou vários separados por vírgula (`OPERACIONAL,MOTORISTAS`). */
  tipoServico: string;
  resumoEquipes: string;
  linhas: LinhaEscalaGeradaDraft[];
  /** ISO local da geração (cabeçalho DATA na 2ª linha). */
  dataGeracaoIso?: string;
  /** Legado: um único cabeçalho para todos os blocos (preferir cabecalhoPorBloco). */
  cabecalhoFormulario?: EscalaCabecalhoFormulario;
  /** Cabeçalho por bloco (impressão definitiva). */
  cabecalhoPorBloco?: Partial<Record<string, EscalaCabecalhoFormulario>>;
  /** Preenchido na modal antes da geração quando o tipo SVG está marcado. */
  svgVoluntario?: SvgEscalaConfig;
  /** Nome exibido na assinatura do Cmt UPM (opcional; senão, busca na linha com função CMT UPM). */
  assinaturaCmtUpmNome?: string;
};

const ORDEM_TIPO_SERVICO: TipoServicoGerar[] = ['OPERACIONAL', 'EXPEDIENTE', 'MOTORISTAS', 'SVG'];

/** Tipos incluídos em «Gerar escala total». */
export const TIPOS_ESCALA_TOTAL: TipoServicoGerar[] = [
  'OPERACIONAL',
  'EXPEDIENTE',
  'MOTORISTAS',
  'SVG',
];

/** Ordenação por função: índices 0–10 = ordem definida; 500 = demais (vai após os ranqueados). */
const FUNCAO_ESCALA_ORDEM_DESCONHECIDO = 500;

function normalizarRotuloFuncaoEscala(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Primeira chave de ordenação na escala (antes do posto no nome): CMT UPM e SubCmt/SubCMT UPM ficam
 * sempre no topo; em seguida Oficial de operações, Oficial (auxiliar), Supervisores 190, Despachante,
 * Telefonistas 190, Expediente ADM, Analista. Demais funções (índice 500) ordenam só por posto/nome.
 */
export function indiceFuncaoOrdenacaoEscala(funcaoNome: string | null | undefined): number {
  const f = normalizarRotuloFuncaoEscala(funcaoNome);
  if (!f) return FUNCAO_ESCALA_ORDEM_DESCONHECIDO;
  const compact = f.replace(/\s/g, '').replace(/-/g, '');

  const temOperacoes = f.includes('OPERACOES') || f.includes('OPERACAO');

  // Variantes mais específicas antes das genéricas (ex.: auxiliar antes de telefonista/oficial base).
  if (f.includes('OFICIAL') && temOperacoes && f.includes('AUXILIAR')) return 3;
  if (f.includes('TELEFONISTA') && f.includes('190') && f.includes('AUXILIAR')) return 8;

  // SUBCMT contém "CMT" — testar antes de CMT UPM.
  const temUpm = f.includes('UPM');
  const ehSubCmtUpm =
    compact.includes('SUBCMTUPM') ||
    compact.includes('SUBTCMTUPM') ||
    (f.includes('SUBCMT') && temUpm) ||
    (f.includes('SUBTCMT') && temUpm) ||
    (f.includes('SUBCOMANDANTE') && temUpm);
  if (ehSubCmtUpm) return 1;

  if (compact.includes('CMTUPM') || /^CMT(\s+|-)?UPM\b/u.test(f)) return 0;

  if (f.includes('OFICIAL') && temOperacoes && !f.includes('AUXILIAR')) return 2;

  if (f.includes('SUPERVISOR') && f.includes('DESPACHO') && f.includes('190')) return 4;
  if (f.includes('SUPERVISOR') && f.includes('ATENDIMENTO') && f.includes('190')) return 5;
  if (f.includes('DESPACHANTE') && f.includes('190')) return 6;
  if (f.includes('TELEFONISTA') && f.includes('190') && !f.includes('AUXILIAR')) return 7;

  if (f.includes('EXPEDIENTE') && f.includes('ADM')) return 9;
  if (f.includes('ANALISTA')) return 10;
  if (f.includes('GUARDA') && f.includes('COPOM')) return 11;

  return FUNCAO_ESCALA_ORDEM_DESCONHECIDO;
}

/** Nome bruto do CMT UPM nas linhas da escala (campo `nome` do policial). */
export function resolverNomeBrutoCmtUpmNasLinhasEscala(
  linhas: LinhaEscalaGeradaDraft[],
): string | null {
  for (const l of linhas) {
    if (l.lista !== 'DISPONIVEL') continue;
    if (indiceFuncaoOrdenacaoEscala(l.funcaoNome) !== 0) continue;
    const n = (l.nome ?? '').trim();
    if (n) return n;
  }
  return null;
}

/** Texto sob a linha de assinatura: "NOME COMPLETO - TC QOPM". */
export function resolverLinhaAssinaturaCmtUpm(
  linhas: LinhaEscalaGeradaDraft[],
  nomeOverride?: string | null,
): string {
  const bruto = (nomeOverride ?? '').trim() || resolverNomeBrutoCmtUpmNasLinhasEscala(linhas) || '';
  return bruto ? formatLinhaAssinaturaCmtUpm(bruto) : '';
}

/** Função primeiro (CMT UPM / SubCMT etc.), depois mesmo critério das listas do sistema (patente no nome + status + nome). */
function compararLinhasEscala(a: LinhaEscalaGeradaDraft, b: LinhaEscalaGeradaDraft): number {
  const fa = indiceFuncaoOrdenacaoEscala(a.funcaoNome);
  const fb = indiceFuncaoOrdenacaoEscala(b.funcaoNome);
  if (fa !== fb) return fa - fb;
  const c = comparePorPatenteENome(
    { nome: a.nome, status: a.ordenacaoPolicialStatus },
    { nome: b.nome, status: b.ordenacaoPolicialStatus },
  );
  if (c !== 0) return c;
  return a.policialId - b.policialId;
}

function timestampDiaLocal(data: Date): number {
  const ano = data.getFullYear();
  const mes = data.getMonth();
  const dia = data.getDate();
  return new Date(ano, mes, dia).getTime();
}

/** Afastamento ATIVO que inclui o dia informado (mesma regra do calendário). */
export function afastamentoAtivoNaData(af: Afastamento, dataRef: Date): boolean {
  if (af.status !== 'ATIVO') return false;
  const dataTimestamp = timestampDiaLocal(dataRef);
  const afInicioStr =
    typeof af.dataInicio === 'string' ? af.dataInicio.split('T')[0] : new Date(af.dataInicio).toISOString().split('T')[0];
  const [anoAfInicio, mesAfInicio, diaAfInicio] = afInicioStr.split('-').map(Number);
  const afInicioTimestamp = new Date(anoAfInicio, mesAfInicio - 1, diaAfInicio).getTime();
  let afFimTimestamp: number | null = null;
  if (af.dataFim) {
    const afFimStr =
      typeof af.dataFim === 'string' ? af.dataFim.split('T')[0] : new Date(af.dataFim).toISOString().split('T')[0];
    const [anoAfFim, mesAfFim, diaAfFim] = afFimStr.split('-').map(Number);
    afFimTimestamp = new Date(anoAfFim, mesAfFim - 1, diaAfFim, 23, 59, 59, 999).getTime();
  }
  const comecaAntesOuDurante = afInicioTimestamp <= dataTimestamp;
  const terminaDepoisOuDurante = afFimTimestamp === null || afFimTimestamp >= dataTimestamp;
  return comecaAntesOuDurante && terminaDepoisOuDurante;
}

export function encontrarAfastamentoNoDia(
  afastamentos: Afastamento[],
  policialId: number,
  dataRef: Date,
): Afastamento | null {
  for (const af of afastamentos) {
    if (af.policialId !== policialId) continue;
    if (afastamentoAtivoNaData(af, dataRef)) return af;
  }
  return null;
}

function detalheAfastamentoTexto(af: Afastamento): string {
  const motivo = af.motivo?.nome ?? '';
  const sei = af.seiNumero ? `SEI ${af.seiNumero}` : '';
  return [motivo, sei].filter(Boolean).join(' · ');
}

import { calcularEquipeMotoristasDia, calcularEquipesOperacionalDia } from './escalaEquipesCalculo';

/** Escala operacional / motoristas: todos os status do cadastro, exceto desativado. */
function policialElegivelEscala(p: Policial): boolean {
  return p.status !== 'DESATIVADO';
}

/**
 * Funções que entram na escala de expediente (alinhado ao cadastro / API):
 * EXPEDIENTE ADM, CMT UPM e SUBCMT UPM (e variantes: hífen, SUBCOMANDANTE, SUBTCMT).
 * Usa a mesma ideia de `indiceFuncaoOrdenacaoEscala`, evitando SUB ser perdido por grafia.
 */
export function nomeFuncaoIndicaExpedienteAdministrativo(nomeFuncao: string | null | undefined): boolean {
  const f = normalizarRotuloFuncaoEscala(nomeFuncao);
  if (!f) return false;
  const compact = f.replace(/\s/g, '').replace(/-/g, '');

  if (f.includes('EXPEDIENTE') && f.includes('ADM')) return true;

  const temUpm = f.includes('UPM');
  const ehSubCmtUpm =
    compact.includes('SUBCMTUPM') ||
    compact.includes('SUBTCMTUPM') ||
    (f.includes('SUBCMT') && temUpm) ||
    (f.includes('SUBTCMT') && temUpm) ||
    (f.includes('SUBCOMANDANTE') && temUpm);
  if (ehSubCmtUpm) return true;

  if (!temUpm) return false;

  const ehCmtSemSub =
    /^CMT(\s+|-)?UPM\b/u.test(f) ||
    (compact.includes('CMTUPM') &&
      !compact.includes('SUBCMTUPM') &&
      !compact.includes('SUBTCMTUPM') &&
      !f.includes('SUB'));
  if (ehCmtSemSub) return true;

  return false;
}

/** Expediente na UI do dashboard inclui todos os não desativados com a função; alinhamos a escala a isso. */
function policialElegivelListaExpediente(p: Policial): boolean {
  return p.status !== 'DESATIVADO';
}

function metaFuncaoNoCatalogo(p: Policial, catalogo: FuncaoOption[] | undefined): FuncaoOption | undefined {
  if (!catalogo?.length || p.funcaoId == null) return undefined;
  return catalogo.find((f) => f.id === p.funcaoId);
}

/** CMT UPM (0), SUBCMT UPM (1), Expediente ADM (9) — mesmo critério de `indiceFuncaoOrdenacaoEscala`, mais flag no cadastro. */
function policialEhFuncaoExpedienteGeracao(
  p: Policial,
  funcoesExpedienteIds: number[] | undefined,
  funcoesCatalogo?: FuncaoOption[],
): boolean {
  const meta = metaFuncaoNoCatalogo(p, funcoesCatalogo);
  if (meta?.escalaExpediente === true) return true;
  const ids = funcoesExpedienteIds;
  const matchPorId =
    ids != null && ids.length > 0 && p.funcaoId != null && ids.includes(p.funcaoId);
  if (matchPorId) return true;
  if (nomeFuncaoIndicaExpedienteAdministrativo(p.funcao?.nome)) return true;
  const idx = indiceFuncaoOrdenacaoEscala(p.funcao?.nome);
  return idx === 0 || idx === 1 || idx === 9;
}

function nomeFuncao(p: Policial): string | null {
  return p.funcao?.nome?.trim() || null;
}

function normEqEscala(s: string | null | undefined): string {
  return (s ?? '').trim().toUpperCase();
}

function ymdTrocaServico(v: string): string {
  return String(v).trim().slice(0, 10);
}

/** Turno cadastrado na troca (07–19h vs 19–07h); ausente em registros antigos → noturno. */
function turnoServicoTroca(
  t: TrocaServicoAtivaListaItem,
  lado: 'A' | 'B',
): 'DIURNO' | 'NOTURNO' {
  const raw = lado === 'A' ? t.turnoServicoA : t.turnoServicoB;
  return raw === 'DIURNO' ? 'DIURNO' : 'NOTURNO';
}

/**
 * Alinha **Gerar escala** operacional com **Troca de serviço** (troca mútua):
 * - Base: `policial.equipe` (cadastro) vs equipe de serviço do dia.
 * - No dia/turno de cada policial na troca: A cumpre na equipe de origem de B (`equipeOrigemB`) e B na de A (`equipeOrigemA`);
 *   quem cede o plantão naquela equipe **não** aparece na escala — só o parceiro que entra.
 */
function aplicarEventoMutuoTrocaServico(
  p: Policial,
  dataIso: string,
  eq: { equipeDia: string; equipeNoite: string },
  turnos: { diurno: boolean; noturno: boolean },
  t: TrocaServicoAtivaListaItem,
  dataEvento: string,
  turnoEvento: 'DIURNO' | 'NOTURNO',
  eventoAtivo: boolean,
  diurno: boolean,
  noturno: boolean,
): { diurno: boolean; noturno: boolean } {
  if (!eventoAtivo || dataIso !== dataEvento) return { diurno, noturno };

  const pid = Number(p.id);
  const idA = Number(t.policialA.id);
  const idB = Number(t.policialB.id);
  const oa = normEqEscala(t.equipeOrigemA);
  const ob = normEqEscala(t.equipeOrigemB);
  const eqD = normEqEscala(eq.equipeDia);
  const eqN = normEqEscala(eq.equipeNoite);

  const aplicarNoTurno = (turno: 'DIURNO' | 'NOTURNO', eqSlot: string, isDiurno: boolean) => {
    if (turnoEvento !== turno) return;
    if (isDiurno ? !turnos.diurno : !turnos.noturno) return;

    if (pid === idA) {
      if (oa !== '' && oa === eqSlot) {
        if (isDiurno) diurno = false;
        else noturno = false;
      }
      if (ob !== '' && ob === eqSlot) {
        if (isDiurno) diurno = true;
        else noturno = true;
      }
    }
    if (pid === idB) {
      if (ob !== '' && ob === eqSlot) {
        if (isDiurno) diurno = false;
        else noturno = false;
      }
      if (oa !== '' && oa === eqSlot) {
        if (isDiurno) diurno = true;
        else noturno = true;
      }
    }
  };

  if (turnos.diurno) aplicarNoTurno('DIURNO', eqD, true);
  if (turnos.noturno) aplicarNoTurno('NOTURNO', eqN, false);

  return { diurno, noturno };
}

function aplicarTrocasServicoOperacional(
  p: Policial,
  dataIso: string,
  eq: { equipeDia: string; equipeNoite: string },
  turnos: { diurno: boolean; noturno: boolean },
  trocas: TrocaServicoAtivaListaItem[],
): { diurno: boolean; noturno: boolean } {
  const eqD = normEqEscala(eq.equipeDia);
  const eqN = normEqEscala(eq.equipeNoite);

  let diurno = Boolean(turnos.diurno && normEqEscala(p.equipe) === eqD);
  let noturno = Boolean(turnos.noturno && normEqEscala(p.equipe) === eqN);

  const overlay = trocas.filter((t) => t.status !== 'CONCLUIDA');

  for (const t of overlay) {
    const dA = ymdTrocaServico(t.dataServicoA);
    const dB = ymdTrocaServico(t.dataServicoB);
    const ta = turnoServicoTroca(t, 'A');
    const tb = turnoServicoTroca(t, 'B');

    ({ diurno, noturno } = aplicarEventoMutuoTrocaServico(
      p,
      dataIso,
      eq,
      turnos,
      t,
      dA,
      ta,
      !t.restauradoA,
      diurno,
      noturno,
    ));
    ({ diurno, noturno } = aplicarEventoMutuoTrocaServico(
      p,
      dataIso,
      eq,
      turnos,
      t,
      dB,
      tb,
      !t.restauradoB,
      diurno,
      noturno,
    ));
  }

  return { diurno, noturno };
}

function policialEstaEmTrocaServicoNoTurno(params: {
  policialId: number;
  dataIso: string;
  turno: 'DIURNO' | 'NOTURNO';
  trocas: TrocaServicoAtivaListaItem[];
}): boolean {
  const { policialId, dataIso, turno, trocas } = params;
  for (const t of trocas) {
    if (t.status === 'CONCLUIDA') continue;
    const idA = Number(t.policialA.id);
    const idB = Number(t.policialB.id);
    const dA = ymdTrocaServico(t.dataServicoA);
    const dB = ymdTrocaServico(t.dataServicoB);
    const tA = turnoServicoTroca(t, 'A');
    const tB = turnoServicoTroca(t, 'B');
    if (policialId === idA && !t.restauradoA && dA === dataIso && tA === turno) return true;
    if (policialId === idB && !t.restauradoB && dB === dataIso && tB === turno) return true;
    if (policialId === idB && !t.restauradoA && dA === dataIso && tA === turno) return true;
    if (policialId === idA && !t.restauradoB && dB === dataIso && tB === turno) return true;
  }
  return false;
}

/**
 * Função motorista: flag no cadastro, ID escolhido na geração, ou nome contendo «MOTORISTA» (legado).
 */
function ehFuncaoMotorista(
  p: Policial,
  funcaoMotoristaId: number | null,
  funcoesCatalogo?: FuncaoOption[],
): boolean {
  const meta = metaFuncaoNoCatalogo(p, funcoesCatalogo);
  if (meta?.escalaMotorista === true) return true;
  if (funcaoMotoristaId != null && p.funcaoId === funcaoMotoristaId) return true;
  const fn = normalizarRotuloFuncaoEscala(p.funcao?.nome);
  return fn.includes('MOTORISTA');
}

/**
 * Monta o payload da escala (disponíveis × afastados) conforme tipo de serviço e data,
 * alinhado ao calendário (12×24 equipes / escala 24×72 motorista de dia) e expediente.
 */
export type OperacionalTurnosOpcao = { diurno: boolean; noturno: boolean };

export function montarPayloadGerarEscalas(
  tipo: TipoServicoGerar,
  dataIso: string,
  policiais: Policial[],
  afastamentos: Afastamento[],
  escala: EscalaParsed,
  opts: {
    funcaoMotoristaId: number | null;
    /** IDs no cadastro de funções equivalentes a expediente adm / CMT / SUBCMT (fallback se `funcao.nome` vier vazio). */
    funcoesExpedienteIds?: number[];
    /** Cadastro de funções (flags escalaOperacional / escalaMotorista / escalaExpediente). */
    funcoesCatalogo?: FuncaoOption[];
    /** Somente para tipo OPERACIONAL: quais turnos incluir na escala gerada. */
    operacionalTurnos?: OperacionalTurnosOpcao;
    /** Trocas ATIVA (e em andamento): ajusta quem entra no operacional conforme data/turno do registro. */
    trocasServicoAtivas?: TrocaServicoAtivaListaItem[];
    svgVoluntario?: SvgEscalaConfig;
  },
): EscalaGeradaDraftPayload {
  const [y, m, d] = dataIso.split('-').map(Number);
  const dataRef = new Date(y, m - 1, d);

  type Cand = {
    policial: Policial;
    horarioServico: string;
    equipeLabel: string | null;
    blocoEscala: BlocoEscalaId;
  };

  const candidatos: Cand[] = [];

  if (tipo === 'OPERACIONAL') {
    const dataEscalaNorm = dataIso.trim().slice(0, 10);
    const turnos = opts.operacionalTurnos ?? { diurno: true, noturno: true };
    if (!turnos.diurno && !turnos.noturno) {
      return {
        dataEscala: dataIso,
        tipoServico: tipo,
        resumoEquipes: 'Selecione ao menos um turno: Diurno e/ou Noturno.',
        linhas: [],
      };
    }

    const eq = calcularEquipesOperacionalDia(y, m - 1, d, escala);
    if (!eq) {
      return {
        dataEscala: dataIso,
        tipoServico: tipo,
        resumoEquipes: 'Data anterior a 01/01/2026 ou fora do cálculo da escala 12×24 das equipes.',
        linhas: [],
      };
    }

    const partesResumo: string[] = [];
    if (turnos.diurno) {
      partesResumo.push(
        `Diurno: equipe ${eq.equipeDia}, ${ESCALA_DIA_INICIO}–${ESCALA_DIA_FIM} (do mesmo dia)`,
      );
    }
    if (turnos.noturno) {
      partesResumo.push(
        `Noturno: equipe ${eq.equipeNoite}, ${ESCALA_NOITE_INICIO} do dia até ${ESCALA_NOITE_FIM} do dia seguinte`,
      );
    }
    let resumo = `Operacional 12×24 — ${partesResumo.join(' · ')}`;
    if (turnos.diurno && turnos.noturno) {
      resumo += `. Período contínuo: das ${ESCALA_DIA_INICIO} da data da escala até as ${ESCALA_NOITE_FIM} do dia seguinte.`;
    }
    resumo += ' Policiais na função motorista não entram nesta lista (use o tipo Motoristas).';
    resumo += ' Superior de dia: mesma rotação 12×24 das equipes, bloco próprio na impressão.';

    const trocasOverlay = opts.trocasServicoAtivas ?? [];

    for (const p of policiais) {
      if (!policialElegivelEscala(p)) continue;
      if (policialFuncaoBloqueiaEscalasEOperacoes(p)) continue;
      if (ehFuncaoMotorista(p, opts.funcaoMotoristaId, opts.funcoesCatalogo)) continue;
      const metaFn = metaFuncaoNoCatalogo(p, opts.funcoesCatalogo);
      if (metaFn && metaFn.escalaOperacional === false) continue;
      if (!p.equipe || p.equipe === 'SEM_EQUIPE') continue;

      const { diurno: incluiDiurno, noturno: incluiNoturno } = aplicarTrocasServicoOperacional(
        p,
        dataEscalaNorm,
        eq,
        turnos,
        trocasOverlay,
      );

      if (incluiDiurno) {
        const emTroca = policialEstaEmTrocaServicoNoTurno({
          policialId: p.id,
          dataIso: dataEscalaNorm,
          turno: 'DIURNO',
          trocas: trocasOverlay,
        });
        candidatos.push({
          policial: p,
          horarioServico: `${ESCALA_DIA_INICIO}–${ESCALA_DIA_FIM}${emTroca ? ' • TROCA DE SERVIÇO' : ''}`,
          equipeLabel: `Equipe ${eq.equipeDia} (serviço diurno — escala ${eq.equipeDia})`,
          blocoEscala: 'EQUIPE_DIURNA_07',
        });
      }
      if (incluiNoturno) {
        const emTroca = policialEstaEmTrocaServicoNoTurno({
          policialId: p.id,
          dataIso: dataEscalaNorm,
          turno: 'NOTURNO',
          trocas: trocasOverlay,
        });
        candidatos.push({
          policial: p,
          horarioServico: `${ESCALA_NOITE_INICIO} (dia da escala)–${ESCALA_NOITE_FIM} (dia seguinte)${emTroca ? ' • TROCA DE SERVIÇO' : ''}`,
          equipeLabel: `Equipe ${eq.equipeNoite} (serviço noturno — escala ${eq.equipeNoite})`,
          blocoEscala: 'EQUIPE_NOTURNA_19_07',
        });
      }
    }

    for (const sup of montarCandidatosSuperiorDeDia(policiais, y, m - 1, d, escala, turnos)) {
      candidatos.push({
        policial: sup.policial,
        horarioServico: sup.horarioServico,
        equipeLabel: sup.equipeLabel,
        blocoEscala: sup.blocoEscala,
      });
    }

    return montarLinhasFinais(dataIso, tipo, resumo, candidatos, afastamentos, dataRef);
  }

  if (tipo === 'MOTORISTAS') {
    const eqMot = calcularEquipeMotoristasDia(y, m - 1, d, escala);
    if (!eqMot) {
      return {
        dataEscala: dataIso,
        tipoServico: tipo,
        resumoEquipes: 'Não foi possível determinar a equipe de motoristas nesta data.',
        linhas: [],
      };
    }
    const resumo = `Motoristas — equipe ${eqMot} da escala ${ESCALA_MOTORISTA_DIA} (motorista de dia, conforme calendário)`;
    for (const p of policiais) {
      if (!policialElegivelEscala(p)) continue;
      if (policialFuncaoBloqueiaEscalasEOperacoes(p)) continue;
      if (policialPossuiRestricaoCadastrada(p)) continue;
      if (!ehFuncaoMotorista(p, opts.funcaoMotoristaId, opts.funcoesCatalogo)) continue;
      if (!p.equipe || p.equipe !== eqMot) continue;
      candidatos.push({
        policial: p,
        horarioServico: `${ESCALA_DIA_INICIO}–${ESCALA_DIA_FIM} / ${ESCALA_NOITE_INICIO}–${ESCALA_NOITE_FIM} (${ESCALA_MOTORISTA_DIA})`,
        equipeLabel: `Equipe ${p.equipe} (motorista)`,
        blocoEscala: 'MOTORISTAS',
      });
    }
    return montarLinhasFinais(dataIso, tipo, resumo, candidatos, afastamentos, dataRef);
  }

  if (tipo === 'SVG') {
    const config = opts.svgVoluntario;
    if (!config?.linhas.length) {
      return {
        dataEscala: dataIso,
        tipoServico: tipo,
        resumoEquipes: 'SVG — configure os policiais e horários na modal antes de gerar.',
        linhas: [],
      };
    }
    const candidatosSvg = montarCandidatosSvgVoluntario(policiais, config);
    const resumo = resumoSvgVoluntarioConfig(config);
    const payload = montarLinhasFinais(dataIso, tipo, resumo, candidatosSvg, afastamentos, dataRef);
    return { ...payload, svgVoluntario: config };
  }

  // EXPEDIENTE — horário por policial/dia (regras em expedienteEscalaRegras.ts)
  const exp = getExpedienteHorario(dataRef);
  const resumo = EXPEDIENTE_ESCALA_RESUMO_REGRAS;
  const idsExp = opts.funcoesExpedienteIds;
  for (const p of policiais) {
    if (!policialElegivelListaExpediente(p)) continue;
    if (policialFuncaoBloqueiaEscalasEOperacoes(p)) continue;
    if (!policialEhFuncaoExpedienteGeracao(p, idsExp, opts.funcoesCatalogo)) continue;
    const idxFn = indiceFuncaoOrdenacaoEscala(p.funcao?.nome);
    const metaFn = metaFuncaoNoCatalogo(p, opts.funcoesCatalogo);
    const preset = metaFn?.expedienteHorarioPreset;
    const ctxExp = {
      indiceFuncaoEscala: idxFn,
      expedienteHorarioPreset:
        preset && preset !== 'AUTO' ? preset : undefined,
    };
    const horario = resolverHorarioExpedientePolicial(p, dataRef, ctxExp);
    if (horario == null) continue;
    const bloco = blocoExpedienteParaPolicial(p, dataRef, ctxExp);
    candidatos.push({
      policial: p,
      horarioServico: horario,
      equipeLabel: p.equipe && p.equipe !== 'SEM_EQUIPE' ? `Equipe ${p.equipe}` : null,
      blocoEscala: bloco,
    });
  }
  if (!exp && candidatos.length === 0) {
    return {
      dataEscala: dataIso,
      tipoServico: tipo,
      resumoEquipes: 'Sem expediente nesta data (fim de semana, feriado ou dia sem expediente cadastrado).',
      linhas: [],
    };
  }
  return montarLinhasFinais(dataIso, tipo, resumo, candidatos, afastamentos, dataRef);
}

function montarLinhasFinais(
  dataIso: string,
  tipo: TipoServicoGerar,
  resumoEquipes: string,
  candidatos: Array<{
    policial: Policial;
    horarioServico: string;
    equipeLabel: string | null;
    blocoEscala: BlocoEscalaId;
  }>,
  afastamentos: Afastamento[],
  dataRef: Date,
): EscalaGeradaDraftPayload {
  const linhas: LinhaEscalaGeradaDraft[] = [];
  for (const c of candidatos) {
    const af = encontrarAfastamentoNoDia(afastamentos, c.policial.id, dataRef);
    const base = {
      policialId: c.policial.id,
      nome: c.policial.nome,
      matricula: c.policial.matricula,
      equipe: c.equipeLabel,
      horarioServico: c.horarioServico,
      funcaoNome: nomeFuncao(c.policial),
      detalheAfastamento: af ? detalheAfastamentoTexto(af) : null,
      tipoServicoLinha: tipo,
      blocoEscala: c.blocoEscala,
      ordenacaoPolicialStatus: c.policial.status,
    };
    if (af) {
      linhas.push({ lista: 'AFASTADO', ...base, blocoEscala: 'AFASTADOS' });
    } else {
      linhas.push({ lista: 'DISPONIVEL', ...base });
    }
  }
  linhas.sort((a, b) => {
    if (a.lista !== b.lista) return a.lista === 'DISPONIVEL' ? -1 : 1;
    return compararLinhasEscala(a, b);
  });
  return { dataEscala: dataIso, tipoServico: tipo, resumoEquipes, linhas };
}

const ESCALA_EXTRA_TIPO_RESUMO: Record<EscalaExtraordinariaTipoServico, string> = {
  CARNAVAL: 'Carnaval',
  SETE_DE_SETEMBRO: '7 de setembro',
  EVENTO: 'Evento',
  OUTRO: 'Outro',
};

/**
 * Escala extraordinária (Carnaval, 7 de setembro, evento descrito, outro): uma linha por policial escolhido,
 * mesmo fluxo de edição/impressão/salvamento da aba «Gerar Escalas».
 */
export function montarPayloadEscalaExtraordinaria(input: {
  dataIso: string;
  horaInicio: string;
  /** Vazio: resumo e linhas mostram só o horário de início (ex.: «07h»). */
  horaFim: string;
  tipoEvento: EscalaExtraordinariaTipoServico;
  /** Se `tipoEvento === 'EVENTO'`, descrição exibida no resumo (substitui o rótulo fixo «Evento»). */
  tipoEventoEventoTexto?: string;
  /** Se `tipoEvento === 'OUTRO'`, texto livre exibido no resumo da escala (substitui o rótulo fixo). */
  tipoEventoOutroTexto?: string;
  policiais: Policial[];
  afastamentos: Afastamento[];
  dataGeracaoIso?: string;
}): EscalaGeradaDraftPayload {
  const { dataIso, horaInicio, horaFim, tipoEvento, policiais, afastamentos } = input;
  const [y, mo, d] = dataIso.split('-').map(Number);
  const dataRef = new Date(y, mo - 1, d);

  const hi = horaInicio.trim().slice(0, 5);
  const hf = horaFim.trim().slice(0, 5);
  const temHorarioFim = hf.length > 0;
  const horarioServicoBase = temHorarioFim ? relogioParaLabel(hi, hf) : formatoRelogioUm(hi);
  const tipoEvtLabel =
    tipoEvento === 'OUTRO'
      ? (input.tipoEventoOutroTexto?.trim() || ESCALA_EXTRA_TIPO_RESUMO.OUTRO)
      : tipoEvento === 'EVENTO'
        ? (input.tipoEventoEventoTexto?.trim() || ESCALA_EXTRA_TIPO_RESUMO.EVENTO)
        : ESCALA_EXTRA_TIPO_RESUMO[tipoEvento];
  const resumoEquipes = `Escala extraordinária — ${tipoEvtLabel} — ${horarioServicoBase}`;

  const nomeFn = (p: Policial) => p.funcao?.nome?.trim() || null;

  const linhas: LinhaEscalaGeradaDraft[] = [];
  for (const p of policiais) {
    if (policialFuncaoBloqueiaEscalasEOperacoes(p)) continue;
    const af = encontrarAfastamentoNoDia(afastamentos, p.id, dataRef);
    const equipeLabel = p.equipe && p.equipe !== 'SEM_EQUIPE' ? `Equipe ${p.equipe}` : null;
    const base = {
      policialId: p.id,
      nome: p.nome,
      matricula: p.matricula,
      equipe: equipeLabel,
      horarioServico: horarioServicoBase,
      funcaoNome: nomeFn(p),
      detalheAfastamento: af ? detalheAfastamentoTexto(af) : null,
      tipoServicoLinha: 'OPERACIONAL' as const,
      blocoEscala: 'ESCALA_EXTRAORDINARIA' as BlocoEscalaId,
      ordenacaoPolicialStatus: p.status,
    };
    if (af) {
      linhas.push({
        lista: 'AFASTADO',
        ...base,
        blocoEscala: 'AFASTADOS',
        tipoServicoLinha: 'EXPEDIENTE' as const,
      });
    } else {
      linhas.push({ lista: 'DISPONIVEL', ...base });
    }
  }

  linhas.sort((a, b) => {
    if (a.lista !== b.lista) return a.lista === 'DISPONIVEL' ? -1 : 1;
    const fa = indiceFuncaoOrdenacaoEscala(a.funcaoNome);
    const fb = indiceFuncaoOrdenacaoEscala(b.funcaoNome);
    if (fa !== fb) return fa - fb;
    const c = comparePorPatenteENome(
      { nome: a.nome, status: a.ordenacaoPolicialStatus },
      { nome: b.nome, status: b.ordenacaoPolicialStatus },
    );
    if (c !== 0) return c;
    return a.policialId - b.policialId;
  });

  return {
    dataEscala: dataIso,
    tipoServico: 'EXTRAORDINARIA',
    resumoEquipes,
    linhas,
    dataGeracaoIso: input.dataGeracaoIso,
  };
}

export function labelTipoServicoUm(tipo: TipoServicoGerar | string): string {
  switch (tipo) {
    case 'OPERACIONAL':
      return 'Operacional';
    case 'EXPEDIENTE':
      return 'Expediente';
    case 'MOTORISTAS':
      return `Motoristas (${ESCALA_MOTORISTA_DIA})`;
    case 'SVG':
      return 'SVG';
    case 'EXTRAORDINARIA':
      return 'Escala extraordinária';
    default:
      return String(tipo);
  }
}

/** Rótulo para um ou vários tipos (ex.: `OPERACIONAL,MOTORISTAS` → "Operacional + Motoristas"). */
export function labelTipoServico(t: string): string {
  const partes = t
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (partes.length === 0) return t;
  return partes.map((p) => labelTipoServicoUm(p)).join(' + ');
}

/**
 * Monta uma única escala a partir de vários tipos marcados (cada linha recebe prefixo do tipo no horário).
 * Afastados duplicados entre tipos são unificados por policial.
 */
export function montarPayloadGerarEscalasCombinado(
  tiposSelecionados: TipoServicoGerar[],
  dataIso: string,
  policiais: Policial[],
  afastamentos: Afastamento[],
  escala: EscalaParsed,
  opts: {
    funcaoMotoristaId: number | null;
    funcoesExpedienteIds?: number[];
    funcoesCatalogo?: FuncaoOption[];
    operacionalTurnos?: OperacionalTurnosOpcao;
    trocasServicoAtivas?: TrocaServicoAtivaListaItem[];
    /** Momento da geração (aba de edição / impressão). */
    dataGeracaoIso?: string;
    svgVoluntario?: SvgEscalaConfig;
  },
): EscalaGeradaDraftPayload {
  const tipos = ORDEM_TIPO_SERVICO.filter((t) => tiposSelecionados.includes(t));
  if (tipos.length === 0) {
    return {
      dataEscala: dataIso,
      tipoServico: '',
      resumoEquipes: 'Marque ao menos um tipo de serviço.',
      linhas: [],
      dataGeracaoIso: opts.dataGeracaoIso,
    };
  }

  const resumos: string[] = [];
  const disponiveis: LinhaEscalaGeradaDraft[] = [];
  const afastadosPorPolicial = new Map<number, LinhaEscalaGeradaDraft>();

  for (const tipo of tipos) {
    const sub = montarPayloadGerarEscalas(tipo, dataIso, policiais, afastamentos, escala, opts);
    const tag = labelTipoServicoUm(tipo);
    resumos.push(`— ${tag} —\n${sub.resumoEquipes}`);

    for (const l of sub.linhas) {
      const linha: LinhaEscalaGeradaDraft = {
        ...l,
        horarioServico: `[${tag}] ${l.horarioServico}`,
      };
      if (l.lista === 'DISPONIVEL') {
        disponiveis.push(linha);
      } else if (!afastadosPorPolicial.has(l.policialId)) {
        afastadosPorPolicial.set(l.policialId, linha);
      }
    }
  }

  disponiveis.sort((a, b) => {
    const ob = indiceOrdenacaoBloco(a.blocoEscala) - indiceOrdenacaoBloco(b.blocoEscala);
    if (ob !== 0) return ob;
    return compararLinhasEscala(a, b);
  });
  const afastados = [...afastadosPorPolicial.values()].sort(compararLinhasEscala);
  const linhas = [...disponiveis, ...afastados];

  return {
    dataEscala: dataIso,
    tipoServico: tipos.join(','),
    resumoEquipes: resumos.join('\n\n'),
    linhas,
    dataGeracaoIso: opts.dataGeracaoIso,
    svgVoluntario: opts.svgVoluntario,
  };
}

export function formatarDataBr(dataIso: string): string {
  const [y, m, d] = dataIso.split('-').map(Number);
  if (!y || !m || !d) return dataIso;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** Ex.: terça-feira, 31 de março de 2026 — para cabeçalho da escala. */
export function formatarDataEscalaPorExtenso(dataIso: string): string {
  const [y, m, d] = dataIso.split('-').map(Number);
  if (!y || !m || !d) return dataIso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
