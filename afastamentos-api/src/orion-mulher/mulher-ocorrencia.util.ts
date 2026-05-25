import type { MulherOperadorPerfilEnum, Prisma } from '@prisma/client';

export type UsuarioOrionMulherReq = {
  id: number;
  nome: string;
  matricula: string;
  sistemasPermitidos: string[];
  isAdmin?: boolean;
  nivel?: { nome?: string | null } | null;
};

export const MULHER_OCORRENCIAS_PAGE_SIZE = 25;

export const mulherOccurrenceListSelect = {
  id: true,
  faseAtual: true,
  concluida: true,
  nomeVitima: true,
  genitoraVitima: true,
  nomeAgressor: true,
  regiaoAdministrativa: true,
  dataHoraOcorrencia: true,
  carimboDataHora: true,
  numeroOcorrenciaCad: true,
  updatedAt: true,
  createdAt: true,
  historicoOcorrencia: true,
  cpfVitima: true,
  dataNascimentoVitima: true,
  enderecoVitima: true,
  telefoneVitima: true,
  pontoReferencia: true,
  enderecoAgressor: true,
  parentescoAgressorVitima: true,
  tipoAmeacaAgressao: true,
  agressorEnvolvimento: true,
  idadeAgressor: true,
  comandanteViatura: true,
  responsavelAtendimento: true,
  encaminhamentoDetalhes: true,
  desfecho: true,
  registrouBoDp: true,
} as const;

const DATE_FIELDS = new Set(['carimboDataHora', 'dataHoraOcorrencia', 'dataNascimentoVitima']);

const STRING_FIELDS = [
  'nomeVitima',
  'enderecoVitima',
  'telefoneVitima',
  'telefoneVitimaSecundario',
  'cpfVitima',
  'genitoraVitima',
  'pontoReferencia',
  'regiaoAdministrativa',
  'historicoOcorrencia',
  'nomeAgressor',
  'enderecoAgressor',
  'parentescoAgressorVitima',
  'tipoAmeacaAgressao',
  'agressorEnvolvimento',
  'idadeAgressor',
  'nomeDenunciante',
  'enderecoDenunciante',
  'telefoneDenunciante',
  'comandanteViatura',
  'responsavelAtendimento',
  'encaminhamentoDetalhes',
  'desfecho',
  'registrouBoDp',
  'numeroOcorrenciaCad',
] as const;

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseStr(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function pickMulherOccurrenceInput(
  body: Record<string, unknown>,
): Partial<Prisma.MulherOcorrenciaUncheckedCreateInput> {
  const out: Partial<Prisma.MulherOcorrenciaUncheckedCreateInput> = {};
  if (typeof body.faseAtual === 'number') out.faseAtual = body.faseAtual;
  if (typeof body.concluida === 'boolean') out.concluida = body.concluida;
  for (const k of STRING_FIELDS) {
    if (body[k] === undefined) continue;
    const v = parseStr(body[k]);
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  for (const k of DATE_FIELDS) {
    if (body[k] === undefined) continue;
    const v = parseDate(body[k]);
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function buildMulherOccurrenceWhere(
  q?: string | null,
  porId?: string | null,
  porCad?: string | null,
): Prisma.MulherOcorrenciaWhereInput | undefined {
  const id = porId?.trim();
  const cad = porCad?.trim();
  const term = q?.trim();
  if (id) return { id };
  if (cad) return { numeroOcorrenciaCad: { contains: cad } };
  if (term) {
    const ic = { contains: term, mode: 'insensitive' as const };
    const useHistorico = term.length >= 6;
    return {
      OR: [
        { nomeVitima: ic },
        { genitoraVitima: ic },
        { nomeAgressor: ic },
        { numeroOcorrenciaCad: ic },
        { regiaoAdministrativa: ic },
        { tipoAmeacaAgressao: ic },
        { desfecho: ic },
        ...(useHistorico ? [{ historicoOcorrencia: ic }] : []),
      ],
    };
  }
  return undefined;
}

export function normalizarTelefoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function validarTelefoneDigits(digits: string): boolean {
  return digits.length === 10 || digits.length === 11;
}

export type MulherPerfilResolvido = MulherOperadorPerfilEnum;
