import type { Afastamento, Policial } from '../types';
import type { EscalaParsed } from './escalaParametros';
import {
  ESCALA_DIA_FIM,
  ESCALA_DIA_INICIO,
  ESCALA_NOITE_FIM,
  ESCALA_NOITE_INICIO,
  getExpedienteHorario,
} from '../constants/svgRegras';

export type TipoServicoGerar = 'OPERACIONAL' | 'EXPEDIENTE' | 'MOTORISTAS';

export type LinhaEscalaGeradaDraft = {
  lista: 'DISPONIVEL' | 'AFASTADO';
  policialId: number;
  nome: string;
  matricula: string;
  equipe: string | null;
  horarioServico: string;
  funcaoNome: string | null;
  detalheAfastamento: string | null;
};

export type EscalaGeradaDraftPayload = {
  dataEscala: string;
  /** Um tipo (`OPERACIONAL`) ou vários separados por vírgula (`OPERACIONAL,MOTORISTAS`). */
  tipoServico: string;
  resumoEquipes: string;
  linhas: LinhaEscalaGeradaDraft[];
};

const ORDEM_TIPO_SERVICO: TipoServicoGerar[] = ['OPERACIONAL', 'EXPEDIENTE', 'MOTORISTAS'];

/** Hierarquia na impressão da escala; índice menor = aparece antes. Quem não casa com nenhum padrão vai ao fim (por nome). */
const POSTO_ESCALA_ORDEM_DESCONHECIDO = 100;

/**
 * Posto pelo início do nome (ex.: `TC Fulano`, `2º TEN Silva`).
 * Usado depois da ordenação por função: TC, MAJ, CAP, 2º TEN, 1º TEN, ASP, ST, 1º–3º SGT, CB, SD.
 */
export function indicePostoOrdenacaoEscala(nome: string): number {
  const n = nome.trim();
  const rules: [RegExp, number][] = [
    [/^2\s*[º°oO]?\s*TEN\b/u, 3],
    [/^1\s*[º°oO]?\s*TEN\b/u, 4],
    [/^3\s*[º°oO]?\s*SGT\b/u, 9],
    [/^2\s*[º°oO]?\s*SGT\b/u, 8],
    [/^1\s*[º°oO]?\s*SGT\b/u, 7],
    [/^TC(\s|\.|$)/u, 0],
    [/^MAJ(\s|\.|$)/u, 1],
    [/^CAP(\s|\.|$)/u, 2],
    [/^ASP(\s|\.|$)/u, 5],
    [/^ST(\s|\.|$)/u, 6],
    [/^CB(\s|\.|$)/u, 10],
    [/^SD(\s|\.|$)/u, 11],
  ];
  for (const [re, ordem] of rules) {
    if (re.test(n)) return ordem;
  }
  return POSTO_ESCALA_ORDEM_DESCONHECIDO;
}

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

  return FUNCAO_ESCALA_ORDEM_DESCONHECIDO;
}

/** Função primeiro (CMT/SUBCMT no topo), depois posto no nome, depois nome — alinha expediente administrativo. */
function compararLinhasEscala(a: LinhaEscalaGeradaDraft, b: LinhaEscalaGeradaDraft): number {
  const fa = indiceFuncaoOrdenacaoEscala(a.funcaoNome);
  const fb = indiceFuncaoOrdenacaoEscala(b.funcaoNome);
  if (fa !== fb) return fa - fb;
  const pa = indicePostoOrdenacaoEscala(a.nome);
  const pb = indicePostoOrdenacaoEscala(b.nome);
  if (pa !== pb) return pa - pb;
  const cmpNome = a.nome.localeCompare(b.nome, 'pt-BR');
  if (cmpNome !== 0) return cmpNome;
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

const DATA_MIN_CALENDARIO = new Date(2026, 0, 1);

export function calcularEquipesOperacionalDia(
  ano: number,
  mes: number,
  dia: number,
  escala: EscalaParsed,
): { equipeDia: string; equipeNoite: string } | null {
  const dataAtual = new Date(ano, mes, dia);
  if (dataAtual.getTime() < DATA_MIN_CALENDARIO.getTime()) return null;
  const dataInicio = escala.dataInicioEquipes;
  const sequencia = escala.sequenciaEquipes;
  const n = sequencia.length;
  if (n === 0) return null;
  const diffTime = dataAtual.getTime() - dataInicio.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const posicaoDia = ((diffDays % n) + n) % n;
  const posicaoNoite = (posicaoDia - 1 + n) % n;
  return { equipeDia: sequencia[posicaoDia], equipeNoite: sequencia[posicaoNoite] };
}

export function calcularEquipeMotoristasDia(ano: number, mes: number, dia: number, escala: EscalaParsed): string | null {
  const dataAtual = new Date(ano, mes, dia);
  if (dataAtual.getTime() < DATA_MIN_CALENDARIO.getTime()) return null;
  const seq = escala.sequenciaMotoristas;
  const nm = seq.length;
  if (nm === 0) return null;
  const diffTime = dataAtual.getTime() - escala.dataInicioMotoristas.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  return seq[diffDays % nm];
}

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

/** CMT UPM (0), SUBCMT UPM (1), Expediente ADM (9) — mesmo critério de `indiceFuncaoOrdenacaoEscala`. */
function policialEhFuncaoExpedienteGeracao(
  p: Policial,
  funcoesExpedienteIds: number[] | undefined,
): boolean {
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

/**
 * Função motorista (catálogo ou nome contendo "MOTORISTA"): não entra no operacional 24×72; use o tipo “Motoristas”.
 */
function ehFuncaoMotorista(p: Policial, funcaoMotoristaId: number | null): boolean {
  if (funcaoMotoristaId != null && p.funcaoId === funcaoMotoristaId) return true;
  const fn = normalizarRotuloFuncaoEscala(p.funcao?.nome);
  return fn.includes('MOTORISTA');
}

/**
 * Monta o payload da escala (disponíveis × afastados) conforme tipo de serviço e data,
 * alinhado ao calendário 24×72 / motoristas / expediente.
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
    /** Somente para tipo OPERACIONAL: quais turnos incluir na escala gerada. */
    operacionalTurnos?: OperacionalTurnosOpcao;
  },
): EscalaGeradaDraftPayload {
  const [y, m, d] = dataIso.split('-').map(Number);
  const dataRef = new Date(y, m - 1, d);

  type Cand = { policial: Policial; horarioServico: string; equipeLabel: string | null };

  const candidatos: Cand[] = [];

  if (tipo === 'OPERACIONAL') {
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
        resumoEquipes: 'Data anterior a 01/01/2026 ou fora do cálculo da escala 24×72.',
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
    let resumo = `Operacional 24×72 — ${partesResumo.join(' · ')}`;
    if (turnos.diurno && turnos.noturno) {
      resumo += `. Período contínuo: das ${ESCALA_DIA_INICIO} da data da escala até as ${ESCALA_NOITE_FIM} do dia seguinte.`;
    }
    resumo += ' Policiais na função motorista não entram nesta lista (use o tipo Motoristas).';

    for (const p of policiais) {
      if (!policialElegivelEscala(p)) continue;
      if (ehFuncaoMotorista(p, opts.funcaoMotoristaId)) continue;
      if (!p.equipe || p.equipe === 'SEM_EQUIPE') continue;
      if (turnos.diurno && p.equipe === eq.equipeDia) {
        candidatos.push({
          policial: p,
          horarioServico: `${ESCALA_DIA_INICIO}–${ESCALA_DIA_FIM}`,
          equipeLabel: `Equipe ${p.equipe} (serviço diurno — escala ${eq.equipeDia})`,
        });
      }
      if (turnos.noturno && p.equipe === eq.equipeNoite) {
        candidatos.push({
          policial: p,
          horarioServico: `${ESCALA_NOITE_INICIO} (dia da escala)–${ESCALA_NOITE_FIM} (dia seguinte)`,
          equipeLabel: `Equipe ${p.equipe} (serviço noturno — escala ${eq.equipeNoite})`,
        });
      }
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
    const resumo = `Motoristas — equipe ${eqMot} da escala 24×72 (conforme calendário)`;
    for (const p of policiais) {
      if (!policialElegivelEscala(p)) continue;
      if (!opts.funcaoMotoristaId || p.funcaoId !== opts.funcaoMotoristaId) continue;
      if (!p.equipe || p.equipe !== eqMot) continue;
      candidatos.push({
        policial: p,
        horarioServico: `${ESCALA_DIA_INICIO}–${ESCALA_DIA_FIM} / ${ESCALA_NOITE_INICIO}–${ESCALA_NOITE_FIM} (24×72)`,
        equipeLabel: `Equipe ${p.equipe} (motorista)`,
      });
    }
    return montarLinhasFinais(dataIso, tipo, resumo, candidatos, afastamentos, dataRef);
  }

  // EXPEDIENTE
  const exp = getExpedienteHorario(dataRef);
  if (!exp) {
    return {
      dataEscala: dataIso,
      tipoServico: tipo,
      resumoEquipes: 'Sem expediente nesta data (fim de semana, feriado ou dia sem expediente cadastrado).',
      linhas: [],
    };
  }
  const resumo = `Expediente — ${exp.inicio} às ${exp.fim}`;
  const idsExp = opts.funcoesExpedienteIds;
  for (const p of policiais) {
    if (!policialElegivelListaExpediente(p)) continue;
    if (!policialEhFuncaoExpedienteGeracao(p, idsExp)) continue;
    candidatos.push({
      policial: p,
      horarioServico: `${exp.inicio}–${exp.fim}`,
      equipeLabel: p.equipe && p.equipe !== 'SEM_EQUIPE' ? `Equipe ${p.equipe}` : null,
    });
  }
  return montarLinhasFinais(dataIso, tipo, resumo, candidatos, afastamentos, dataRef);
}

function montarLinhasFinais(
  dataIso: string,
  tipo: TipoServicoGerar,
  resumoEquipes: string,
  candidatos: Array<{ policial: Policial; horarioServico: string; equipeLabel: string | null }>,
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
    };
    if (af) {
      linhas.push({ lista: 'AFASTADO', ...base });
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

export function labelTipoServicoUm(tipo: TipoServicoGerar | string): string {
  switch (tipo) {
    case 'OPERACIONAL':
      return 'Operacional';
    case 'EXPEDIENTE':
      return 'Expediente';
    case 'MOTORISTAS':
      return 'Motoristas';
    default:
      return String(tipo);
  }
}

/** Rótulo para um ou vários tipos (ex.: `OPERACIONAL,MOTORISTAS` → "Operacional + Motoristas"). */
export function labelTipoServico(t: string): string {
  const partes = t
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as TipoServicoGerar[];
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
    operacionalTurnos?: OperacionalTurnosOpcao;
  },
): EscalaGeradaDraftPayload {
  const tipos = ORDEM_TIPO_SERVICO.filter((t) => tiposSelecionados.includes(t));
  if (tipos.length === 0) {
    return {
      dataEscala: dataIso,
      tipoServico: '',
      resumoEquipes: 'Marque ao menos um tipo de serviço.',
      linhas: [],
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

  disponiveis.sort(compararLinhasEscala);
  const afastados = [...afastadosPorPolicial.values()].sort(compararLinhasEscala);
  const linhas = [...disponiveis, ...afastados];

  return {
    dataEscala: dataIso,
    tipoServico: tipos.join(','),
    resumoEquipes: resumos.join('\n\n'),
    linhas,
  };
}

export function formatarDataBr(dataIso: string): string {
  const [y, m, d] = dataIso.split('-').map(Number);
  if (!y || !m || !d) return dataIso;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}
