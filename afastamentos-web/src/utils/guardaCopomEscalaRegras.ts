import type { Policial } from '../types';

/** Segunda-feira 18/05/2026 — fase PAR em seg/qua/sex (2º SGT Manoel Pereira dos Santos de plantão). */
export const GUARDA_COPOM_ANCORAGEM_YMD = '2026-05-18';

const HORARIO_GUARDA_COPOM = '07h às 19h';

export function funcaoNomeIndicaGuardaCopom(nomeFuncao: string | null | undefined): boolean {
  const f = (nomeFuncao ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!f) return false;
  return f.includes('GUARDA') && f.includes('COPOM');
}

export function normalizarNomeGuardaCopom(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function policialNomeIndicaManoelGuardaCopom(nome: string): boolean {
  return normalizarNomeGuardaCopom(nome).includes('MANOEL PEREIRA DOS SANTOS');
}

export function policialNomeIndicaEdilsonGuardaCopom(nome: string): boolean {
  return normalizarNomeGuardaCopom(nome).includes('EDILSON PEREIRA DE ALMEIDA');
}

/** Segunda-feira da semana ISO local da data informada. */
function segundaFeiraSemanaLocal(dataRef: Date): Date {
  const d = new Date(dataRef.getFullYear(), dataRef.getMonth(), dataRef.getDate());
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}

/** Semanas corridas (segunda a segunda) desde a âncora 18/05/2026. */
function semanasDesdeAncoraGuardaCopom(dataRef: Date): number {
  const [yA, mA, dA] = GUARDA_COPOM_ANCORAGEM_YMD.split('-').map(Number);
  const anchor = segundaFeiraSemanaLocal(new Date(yA, mA - 1, dA));
  const monday = segundaFeiraSemanaLocal(dataRef);
  return Math.round((monday.getTime() - anchor.getTime()) / (7 * 86_400_000));
}

/**
 * Alternância **semanal** entre os pares PAR/IMPAR.
 * `true` = fase PAR cumpre seg/qua/sex; `false` = fase PAR cumpre ter/qui (IMPAR o inverso).
 * Ancorado em 18/05/2026 (segunda) com Manoel (PAR) em seg/qua/sex na semana de referência.
 */
export function guardaCopomParTemSegundaQuartaSexta(dataRef: Date): boolean {
  return semanasDesdeAncoraGuardaCopom(dataRef) % 2 === 0;
}

function resolveFaseGuardaCopom(
  policial: Policial,
): 'PAR' | 'IMPAR' | null {
  if (policial.expediente12x36Fase === 'PAR' || policial.expediente12x36Fase === 'IMPAR') {
    return policial.expediente12x36Fase;
  }
  if (policialNomeIndicaManoelGuardaCopom(policial.nome)) return 'PAR';
  if (policialNomeIndicaEdilsonGuardaCopom(policial.nome)) return 'IMPAR';
  return null;
}

/**
 * Horário do policial na escala Guarda COPOM (seg–sex, 12×36), ou null se folga.
 */
export function resolverHorarioGuardaCopomPolicial(policial: Policial, dataRef: Date): string | null {
  const dow = dataRef.getDay();
  if (dow === 0 || dow === 6) return null;

  const fase = resolveFaseGuardaCopom(policial);
  if (!fase) return null;

  const parMws = guardaCopomParTemSegundaQuartaSexta(dataRef);
  const trabalhaMws = fase === 'PAR' ? parMws : !parMws;

  if (trabalhaMws) {
    if (dow === 1 || dow === 3 || dow === 5) return HORARIO_GUARDA_COPOM;
    return null;
  }
  if (dow === 2 || dow === 4) return HORARIO_GUARDA_COPOM;
  return null;
}
