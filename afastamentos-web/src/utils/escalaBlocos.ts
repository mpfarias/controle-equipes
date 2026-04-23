import { ESCALA_MOTORISTA_DIA } from '../constants/escalaMotoristasDia';

/**
 * Blocos da escala impressa (ordem fixa). SVG: placeholders até tela dedicada.
 */
export type BlocoEscalaId =
  | 'ESCALA_EXTRAORDINARIA'
  | 'EXP_ALT_SEMANAL_07'
  | 'EXP_07_13'
  | 'EQUIPE_DIURNA_07'
  | 'MOTORISTAS'
  | 'SVG_10_18'
  | 'EXP_13_19_ORG'
  | 'EXP_13_19_SEG_SEX'
  | 'EXP_DIFERENCIADO'
  | 'SVG_15_23'
  | 'EQUIPE_NOTURNA_19_07'
  | 'SVG_20_04'
  | 'AFASTADOS';

export const ORDEM_BLOCOS_IMPRESSAO: BlocoEscalaId[] = [
  'ESCALA_EXTRAORDINARIA',
  'EXP_ALT_SEMANAL_07',
  'EXP_07_13',
  'EQUIPE_DIURNA_07',
  'MOTORISTAS',
  'SVG_10_18',
  'EXP_13_19_SEG_SEX',
  'EXP_DIFERENCIADO',
  'SVG_15_23',
  'EQUIPE_NOTURNA_19_07',
  'SVG_20_04',
];

const TITULOS: Record<BlocoEscalaId, string> = {
  ESCALA_EXTRAORDINARIA: 'Escala extraordinária de serviço',
  EXP_ALT_SEMANAL_07: 'Expediente',
  EXP_07_13: 'Expediente — período da manhã',
  EQUIPE_DIURNA_07: 'Equipe',
  MOTORISTAS: `Motoristas (${ESCALA_MOTORISTA_DIA})`,
  SVG_10_18: 'SVG',
  EXP_13_19_ORG: 'Expediente',
  EXP_13_19_SEG_SEX: 'Expediente',
  EXP_DIFERENCIADO: 'Expediente — horários diferenciados',
  SVG_15_23: 'SVG',
  EQUIPE_NOTURNA_19_07: 'Equipe',
  SVG_20_04: 'SVG',
  AFASTADOS: 'Policiais afastados no dia',
};

/**
 * CMT/SubCmt passam a imprimir no mesmo bloco do expediente padrão (`EXP_13_19_SEG_SEX`).
 * Rascunhos antigos com `EXP_13_19_ORG` são tratados como esse bloco.
 */
export function normalizarBlocoEscalaImpressao(id: BlocoEscalaId | string | undefined): BlocoEscalaId {
  if (id === 'EXP_13_19_ORG') return 'EXP_13_19_SEG_SEX';
  return (id ?? 'EXP_DIFERENCIADO') as BlocoEscalaId;
}

export function tituloBlocoEscala(id: BlocoEscalaId): string {
  return TITULOS[id] ?? id;
}

/** Cabeçalho «HORÁRIO» na escala extraordinária: início do período informado na linha (antes de «às»). */
export function rotuloHorarioApartirDeServico(horarioServicoLinha: string): string {
  const limpo = horarioServicoLinha.replace(/^\[[^\]]+\]\s*/u, '').trim();
  if (!limpo) return 'A partir de —';
  const lower = limpo.toLowerCase();
  const idx = lower.indexOf(' às ');
  const inicio = idx === -1 ? limpo : limpo.slice(0, idx).trim();
  return `A partir de ${inicio}`;
}

/** Extrai a letra/código da equipe a partir do texto gerado (ex.: "Equipe E (serviço diurno…)" → "E"). */
export function letraEquipeDasLinhas(rows: { equipe: string | null }[]): string | null {
  for (const r of rows) {
    const eq = r.equipe?.trim();
    if (!eq) continue;
    const m = eq.match(/Equipe\s+([A-ZÀ-Ü0-9]+)/iu);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

/** Título do bloco na impressão/edição: equipe com letra (C, A, E…); 1º expediente sem "revezamento". */
export function tituloBlocoEscalaComLinhas(
  id: BlocoEscalaId,
  rows: { equipe: string | null }[],
): string {
  const norm = normalizarBlocoEscalaImpressao(id);
  if (norm === 'EQUIPE_DIURNA_07' || norm === 'EQUIPE_NOTURNA_19_07') {
    const letra = letraEquipeDasLinhas(rows);
    return letra ? `Equipe ${letra}` : 'Equipe';
  }
  if (norm === 'EXP_ALT_SEMANAL_07') return 'Expediente';
  return tituloBlocoEscala(norm);
}

export function indiceOrdenacaoBloco(bloco: string | undefined): number {
  if (!bloco) return 999;
  const id = normalizarBlocoEscalaImpressao(bloco as BlocoEscalaId);
  const i = ORDEM_BLOCOS_IMPRESSAO.indexOf(id);
  return i === -1 ? 998 : i;
}

export function ehBlocoSvgPlaceholder(id: BlocoEscalaId): boolean {
  return id === 'SVG_10_18' || id === 'SVG_15_23' || id === 'SVG_20_04';
}

/** Metadados do cabeçalho (linhas 1–2) — preenchidos na aba de edição da escala. */
export type EscalaCabecalhoFormulario = {
  horario: string;
  tipo: string;
  circunstancia: string;
  especialidade: string;
  observacoes: string;
};

/** Texto fixo na coluna HORÁRIO (preenchido pelo sistema). */
export const ESCALA_CABECALHO_HORARIO_AUTOMATICO = 'Automático (regras do sistema)';

export const ESCALA_CAB_OPCOES_TIPO = ['Apoio Operacional', 'Administrativo'] as const;

export const ESCALA_CAB_OPCOES_CIRCUNSTANCIA = ['Ordinário', 'Voluntário'] as const;

export const ESCALA_CAB_OPCOES_ESPECIALIDADE = [
  'Geral',
  'Serviço Interno',
  'Telemática e Comunicações',
] as const;
