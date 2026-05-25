import type { Policial } from '../types';
import { getExpedienteHorario } from '../constants/svgRegras';
import type { BlocoEscalaId } from './escalaBlocos';
import {
  funcaoNomeIndicaGuardaCopom,
  resolverHorarioGuardaCopomPolicial,
  guardaCopomParTemSegundaQuartaSexta,
} from './guardaCopomEscalaRegras';
import { getISOWeekLocal } from './isoWeekLocal';

export { getISOWeekLocal } from './isoWeekLocal';

/**
 * Regras de horário do expediente na geração de escalas (UPM).
 *
 * - Ajuste horários, nomes ou alternância de semana editando este arquivo.
 * - Afastamentos continuam sendo tratados em `gerarEscalasCalculo` (lista separada).
 * - SVG: bloco separado / outra tela (fora do escopo aqui).
 * - Quem entra na lista de expediente na geração também depende do cadastro da função (`escalaExpediente` e `expedienteHorarioPreset` em Gestão → Funções).
 */

/**
 * Alternância **semanal** do padrão seg/qua/sex × ter/qui entre PAR e IMPAR.
 *
 * `true` = Manoel (PAR) em seg/qua/sex e Edilson (IMPAR) em ter/qui.
 * `false` = Manoel em ter/qui e Edilson em seg/qua/sex.
 *
 * Referência: 18/05/2026 (segunda) — Manoel (PAR) em seg/qua/sex na semana âncora.
 */
export function manoelTemPadraoSegundaQuartaSexta(dataRef: Date): boolean {
  return guardaCopomParTemSegundaQuartaSexta(dataRef);
}

/** true = semanas ISO pares trabalha Valdivino; ímpares = Francisco (regra legada antes da âncora). */
export const EXPEDIENTE_12X36_VALDIVINO_SEMANA_PAR = true;

/** Segunda 25/05/2026 — a partir desta semana ISO, Francisco assume a escala (Valdivino na semana seguinte). */
export const VALDIVINO_FRANCISCO_ANCORAGEM_YMD = '2026-05-25';

/** Francisco ativo na semana ISO da data (Valdivino na semana em que retorna false). */
export function franciscoAtivoSemana12x36Valdivino(dataRef: Date): boolean {
  const [yA, mA, dA] = VALDIVINO_FRANCISCO_ANCORAGEM_YMD.split('-').map(Number);
  const wAnchor = getISOWeekLocal(new Date(yA, mA - 1, dA));
  const w = getISOWeekLocal(dataRef);
  if (w < wAnchor) {
    return semanaPar(dataRef) !== EXPEDIENTE_12X36_VALDIVINO_SEMANA_PAR;
  }
  let diff = w - wAnchor;
  diff %= 2;
  if (diff < 0) diff += 2;
  return diff === 0;
}

export function normalizarNomeEscala(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function contemNome(nomePolicial: string, trecho: string): boolean {
  return normalizarNomeEscala(nomePolicial).includes(normalizarNomeEscala(trecho));
}

function semanaPar(d: Date): boolean {
  return getISOWeekLocal(d) % 2 === 0;
}

/** Converte "13:00" / "07:30" para rótulo "13h" / "07h30". */
export function formatoRelogioUm(s: string): string {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h)) return s;
  if (m === 0) return `${String(h).padStart(2, '0')}h`;
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

/** Intervalo "13h às 19h" a partir de dois horários "HH:mm". */
export function relogioParaLabel(inicio: string, fim: string): string {
  return `${formatoRelogioUm(inicio)} às ${formatoRelogioUm(fim)}`;
}

/** Horário “padrão órgão” do dia (seg–qui 13–19, sex 07–13), ou null. */
export function horarioOrgaoExpedienteLabel(dataRef: Date): string | null {
  const e = getExpedienteHorario(dataRef);
  if (!e) return null;
  return relogioParaLabel(e.inicio, e.fim);
}

function ehExpedienteAdm(p: Policial): boolean {
  const f = normalizarNomeEscala(p.funcao?.nome ?? '');
  return f.includes('EXPEDIENTE') && f.includes('ADM');
}

/** Valores persistidos em `Funcao.expedienteHorarioPreset` (exceto AUTO, que não entra no contexto). */
export type ExpedienteHorarioPresetFuncao =
  | 'ORGAO_DIAS_UTEIS'
  | 'SEG_SEX_07_19'
  | 'SEG_SEX_12X36_SEMANA_ALTERNADA'
  | 'JORNADA_24X72'
  | 'GUARDA_COPOM_12X36';

export type ContextoResolverExpediente = {
  /** Resultado de `indiceFuncaoOrdenacaoEscala` no momento da geração (evita import circular). */
  indiceFuncaoEscala: number;
  /** Quando definido, tem prioridade sobre regras por nome do policial. */
  expedienteHorarioPreset?: ExpedienteHorarioPresetFuncao;
};

/**
 * Para a data da escala: horário de serviço do policial no expediente, ou null se não trabalha neste dia.
 * Só deve ser chamado para dias em que `getExpedienteHorario(dataRef) !== null`.
 */
export function resolverHorarioExpedientePolicial(
  policial: Policial,
  dataRef: Date,
  ctx: ContextoResolverExpediente,
): string | null {
  const preset = ctx.expedienteHorarioPreset;
  const ignoraCalendarioExpediente =
    preset === 'JORNADA_24X72' || preset === 'GUARDA_COPOM_12X36';
  if (!ignoraCalendarioExpediente && getExpedienteHorario(dataRef) === null) return null;

  const dow = dataRef.getDay(); // 0 dom … 6 sáb
  if (!ignoraCalendarioExpediente && (dow === 0 || dow === 6)) return null;

  const org = horarioOrgaoExpedienteLabel(dataRef);

  if (preset === 'ORGAO_DIAS_UTEIS') {
    return org;
  }
  if (preset === 'SEG_SEX_07_19') {
    if (dow >= 1 && dow <= 5) return '07h às 19h';
    return null;
  }
  if (preset === 'SEG_SEX_12X36_SEMANA_ALTERNADA') {
    const fase = policial.expediente12x36Fase;
    if (!fase) return null;
    const par = semanaPar(dataRef);
    const ativo = (fase === 'PAR' && par) || (fase === 'IMPAR' && !par);
    if (!ativo) return null;
    if (dow >= 1 && dow <= 5) return '07h às 19h';
    return null;
  }
  if (preset === 'JORNADA_24X72') {
    return '24x72';
  }
  if (preset === 'GUARDA_COPOM_12X36' || funcaoNomeIndicaGuardaCopom(policial.funcao?.nome)) {
    return resolverHorarioGuardaCopomPolicial(policial, dataRef);
  }

  const nome = policial.nome;

  // --- 1) 12×36 (Manoel / Edilson), legado por nome quando a função não é Guarda COPOM no cadastro.
  const horarioManoelEdilson = '07h às 19h';
  if (contemNome(nome, 'MANOEL PEREIRA DOS SANTOS')) {
    const manoelMws = manoelTemPadraoSegundaQuartaSexta(dataRef);
    if (manoelMws) {
      if (dow === 1 || dow === 3 || dow === 5) return horarioManoelEdilson;
      return null;
    }
    if (dow === 2 || dow === 4) return horarioManoelEdilson;
    return null;
  }
  if (contemNome(nome, 'EDILSON PEREIRA DE ALMEIDA')) {
    const manoelMws = manoelTemPadraoSegundaQuartaSexta(dataRef);
    if (manoelMws) {
      if (dow === 2 || dow === 4) return horarioManoelEdilson;
      return null;
    }
    if (dow === 1 || dow === 3 || dow === 5) return horarioManoelEdilson;
    return null;
  }

  // --- 2a) Seg–sex 07h–13h ---
  if (
    contemNome(nome, 'MASSILON DE OLIVEIRA SILVA') ||
    contemNome(nome, 'SERGIO EDUARDO PEREIRA DE ARAUJO') ||
    contemNome(nome, 'RAFAEL GADELHA DE MENEZES')
  ) {
    if (dow >= 1 && dow <= 5) return '07h às 13h';
    return null;
  }

  // --- 2b) Clayton: seg, ter, qui, sex 13–19; qua 07–13 ---
  if (contemNome(nome, 'CLAYTON MARTINS LOPES')) {
    if (dow === 1 || dow === 2 || dow === 4 || dow === 5) return '13h às 19h';
    if (dow === 3) return '07h às 13h';
    return null;
  }

  // --- 2c) Celio: seg–qui 19h–01h ---
  if (contemNome(nome, 'CELIO GIL DA SILVA ESPIG')) {
    if (dow >= 1 && dow <= 4) return '19h às 01h';
    return null;
  }

  // --- 2d) Igor: seg e qua 11–17; ter e qui 13–19; sex 07–13 ---
  if (contemNome(nome, 'IGOR ARTUR DE OLIVEIRA GUIMARAES')) {
    if (dow === 1 || dow === 3) return '11h às 17h';
    if (dow === 2 || dow === 4) return '13h às 19h';
    if (dow === 5) return '07h às 13h';
    return null;
  }

  // --- 2e) 12×36 semanal, seg–sex 07–19 quando “na semana” (Valdivino × Francisco) ---
  if (contemNome(nome, 'VALDIVINO BARBOSA GRACIANO')) {
    if (!franciscoAtivoSemana12x36Valdivino(dataRef)) {
      if (dow >= 1 && dow <= 5) return '07h às 19h';
    }
    return null;
  }
  if (contemNome(nome, 'FRANCISCO JOSE FERNANDES DE ARAUJO')) {
    if (franciscoAtivoSemana12x36Valdivino(dataRef)) {
      if (dow >= 1 && dow <= 5) return '07h às 19h';
    }
    return null;
  }

  // --- 2f) Seg–sex 13h–19h ---
  if (
    contemNome(nome, 'MARCIA DE LOURDES COSTA MOREIRA TORRES') ||
    contemNome(nome, 'MARCELO PIRES DE FARIAS') ||
    contemNome(nome, 'WELKYLLANE ARAUJO SILVA')
  ) {
    if (dow >= 1 && dow <= 5) return '13h às 19h';
    return null;
  }

  // --- 2g) Luiz Henrique: seg–sex 14h–20h ---
  if (contemNome(nome, 'LUIZ HENRIQUE TORRES CARDOSO')) {
    if (dow >= 1 && dow <= 5) return '14h às 20h';
    return null;
  }

  // --- CMT / SubCmt UPM: horário do órgão em todos os dias úteis ---
  if (ctx.indiceFuncaoEscala === 0 || ctx.indiceFuncaoEscala === 1) {
    return org;
  }

  // --- Expediente ADM genérico: seg–qui 13h–19h; sexta segue o horário do órgão (07h–13h), como CMT/SubCmt ---
  if (ctx.indiceFuncaoEscala === 9 || ehExpedienteAdm(policial)) {
    if (dow >= 1 && dow <= 4) return '13h às 19h';
    if (dow === 5 && org) return org;
    return null;
  }

  return org;
}

/**
 * Bloco de impressão para expediente (ordem dos testes importa).
 * Só chamar se o policial entra na lista da data (resolver ≠ null).
 */
export function blocoExpedienteParaPolicial(
  policial: Policial,
  _dataRef: Date,
  ctx: ContextoResolverExpediente,
): BlocoEscalaId {
  const preset = ctx.expedienteHorarioPreset;
  if (preset === 'ORGAO_DIAS_UTEIS') {
    return 'EXP_13_19_SEG_SEX';
  }
  if (preset === 'SEG_SEX_07_19' || preset === 'SEG_SEX_12X36_SEMANA_ALTERNADA') {
    return 'EXP_ALT_SEMANAL_07';
  }
  if (preset === 'JORNADA_24X72') {
    return 'EXP_DIFERENCIADO';
  }
  if (preset === 'GUARDA_COPOM_12X36' || funcaoNomeIndicaGuardaCopom(policial.funcao?.nome)) {
    return 'EXP_ALT_SEMANAL_07';
  }

  const nome = policial.nome;

  if (contemNome(nome, 'MANOEL PEREIRA DOS SANTOS') || contemNome(nome, 'EDILSON PEREIRA DE ALMEIDA')) {
    return 'EXP_ALT_SEMANAL_07';
  }
  if (
    contemNome(nome, 'MASSILON DE OLIVEIRA SILVA') ||
    contemNome(nome, 'SERGIO EDUARDO PEREIRA DE ARAUJO') ||
    contemNome(nome, 'RAFAEL GADELHA DE MENEZES')
  ) {
    return 'EXP_07_13';
  }
  if (ctx.indiceFuncaoEscala === 0 || ctx.indiceFuncaoEscala === 1) {
    return 'EXP_13_19_SEG_SEX';
  }
  if (
    contemNome(nome, 'MARCIA DE LOURDES COSTA MOREIRA TORRES') ||
    contemNome(nome, 'MARCELO PIRES DE FARIAS') ||
    contemNome(nome, 'WELKYLLANE ARAUJO SILVA')
  ) {
    return 'EXP_13_19_SEG_SEX';
  }
  if (
    contemNome(nome, 'CLAYTON MARTINS LOPES') ||
    contemNome(nome, 'CELIO GIL DA SILVA ESPIG') ||
    contemNome(nome, 'IGOR ARTUR DE OLIVEIRA GUIMARAES') ||
    contemNome(nome, 'VALDIVINO BARBOSA GRACIANO') ||
    contemNome(nome, 'FRANCISCO JOSE FERNANDES DE ARAUJO') ||
    contemNome(nome, 'LUIZ HENRIQUE TORRES CARDOSO')
  ) {
    return 'EXP_DIFERENCIADO';
  }
  if (ctx.indiceFuncaoEscala === 9 || ehExpedienteAdm(policial)) {
    return 'EXP_13_19_SEG_SEX';
  }
  return 'EXP_DIFERENCIADO';
}

/** Texto curto para o resumo da escala (expediente). */
export const EXPEDIENTE_ESCALA_RESUMO_REGRAS =
  'Expediente — 13h às 19h (segunda a quinta) e sexta 07h às 13h, salvo exceções no bloco horários diferenciados. ' +
  'Guarda COPOM / Manoel–Edilson: 12×36 seg–sex (seg/qua/sex vs ter/qui, alternância semanal; âncora 18/05/2026). ' +
  'Funções com preset no cadastro (ex.: Guarda COPOM, 12×36 seg–sex por semana ISO) têm prioridade sobre regras por nome. ' +
  'CMT/SubCmt no topo da lista do expediente. Ajustes: expedienteEscalaRegras.ts.';
