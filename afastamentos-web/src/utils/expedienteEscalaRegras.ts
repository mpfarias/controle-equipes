import type { Policial } from '../types';
import { getExpedienteHorario } from '../constants/svgRegras';
import type { BlocoEscalaId } from './escalaBlocos';

/**
 * Regras de horário do expediente na geração de escalas (UPM).
 *
 * - Ajuste horários, nomes ou alternância de semana editando este arquivo.
 * - Afastamentos continuam sendo tratados em `gerarEscalasCalculo` (lista separada).
 * - SVG: bloco separado / outra tela (fora do escopo aqui).
 */

/**
 * Alternância do padrão a cada **duas semanas ISO** (ex.: sem. 15 e 16 = mesmo padrão; 17 e 18 = invertido),
 * para que terças consecutivas como 07/04 e 14/04 não invertam o par Manoel/Edilson no meio da quinzena.
 *
 * `true` = Manoel em seg/qua/sex e Edilson em ter/qui.
 * `false` = Manoel em ter/qui e Edilson em seg/qua/sex.
 *
 * Referência: 07/04 e 14/04/2026 (terças nas sem. 15 e 16) — Manoel em ter/qui.
 */
export function manoelTemPadraoSegundaQuartaSexta(dataRef: Date): boolean {
  const w = getISOWeekLocal(dataRef);
  return Math.floor((w - 1) / 2) % 2 === 0;
}

/** true = semanas ISO pares trabalha Valdivino; ímpares = Francisco (12×36 em alternância). */
export const EXPEDIENTE_12X36_VALDIVINO_SEMANA_PAR = true;

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

/** Número da semana ISO 8601 (1–53), baseado na data local. */
export function getISOWeekLocal(d: Date): number {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  );
}

function semanaPar(d: Date): boolean {
  return getISOWeekLocal(d) % 2 === 0;
}

/** Converte "13:00" / "07:00" para rótulo "13h" / "07h". */
export function relogioParaLabel(inicio: string, fim: string): string {
  const fmt = (s: string) => {
    const [h, m] = s.split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(h)) return s;
    if (m === 0) return `${String(h).padStart(2, '0')}h`;
    return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
  };
  return `${fmt(inicio)} às ${fmt(fim)}`;
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

export type ContextoResolverExpediente = {
  /** Resultado de `indiceFuncaoOrdenacaoEscala` no momento da geração (evita import circular). */
  indiceFuncaoEscala: number;
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
  if (getExpedienteHorario(dataRef) === null) return null;

  const dow = dataRef.getDay(); // 0 dom … 6 sáb
  if (dow === 0 || dow === 6) return null;

  const nome = policial.nome;
  const org = horarioOrgaoExpedienteLabel(dataRef);

  // --- 1) 12×36 (Manoel / Edilson): seg/qua/sex vs ter/qui; alternância quinzenal. Sempre 07h–19h nos dias de serviço.
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

  // --- 2e) 12×36 semanal, seg–sex 07–19 quando “na semana” ---
  if (contemNome(nome, 'VALDIVINO BARBOSA GRACIANO')) {
    const on = semanaPar(dataRef) === EXPEDIENTE_12X36_VALDIVINO_SEMANA_PAR;
    if (!on) return null;
    if (dow >= 1 && dow <= 5) return '07h às 19h';
    return null;
  }
  if (contemNome(nome, 'FRANCISCO JOSE FERNANDES DE ARAUJO')) {
    const on = semanaPar(dataRef) !== EXPEDIENTE_12X36_VALDIVINO_SEMANA_PAR;
    if (!on) return null;
    if (dow >= 1 && dow <= 5) return '07h às 19h';
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

  // --- CMT / SubCmt UPM: horário do órgão em todos os dias úteis ---
  if (ctx.indiceFuncaoEscala === 0 || ctx.indiceFuncaoEscala === 1) {
    return org;
  }

  // --- Expediente ADM genérico: seg–qui 13h–19h (sex não entra na regra “quase todos”) ---
  if (ctx.indiceFuncaoEscala === 9 || ehExpedienteAdm(policial)) {
    if (dow >= 1 && dow <= 4) return '13h às 19h';
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
    contemNome(nome, 'FRANCISCO JOSE FERNANDES DE ARAUJO')
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
  'Manoel/Edilson: 12×36 em blocos de 2 semanas ISO (seg/qua/sex vs ter/qui, alternando a cada quinzena). ' +
  'CMT/SubCmt no topo da lista do expediente. Ajustes: expedienteEscalaRegras.ts.';
