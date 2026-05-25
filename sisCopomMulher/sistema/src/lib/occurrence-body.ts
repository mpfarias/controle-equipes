import type { Prisma } from "@prisma/client";

const DATE_FIELDS = new Set([
  "carimboDataHora",
  "dataHoraOcorrencia",
  "dataNascimentoVitima",
]);

const STRING_FIELDS = [
  "nomeVitima",
  "enderecoVitima",
  "telefoneVitima",
  "telefoneVitimaSecundario",
  "cpfVitima",
  "genitoraVitima",
  "pontoReferencia",
  "regiaoAdministrativa",
  "historicoOcorrencia",
  "nomeAgressor",
  "enderecoAgressor",
  "parentescoAgressorVitima",
  "tipoAmeacaAgressao",
  "agressorEnvolvimento",
  "idadeAgressor",
  "nomeDenunciante",
  "enderecoDenunciante",
  "telefoneDenunciante",
  "comandanteViatura",
  "responsavelAtendimento",
  "encaminhamentoDetalhes",
  "desfecho",
  "registrouBoDp",
  "numeroOcorrenciaCad",
] as const;

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseStr(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function pickOccurrenceInput(
  body: Record<string, unknown>,
): Partial<Prisma.OccurrenceUncheckedCreateInput> {
  const out: Partial<Prisma.OccurrenceUncheckedCreateInput> = {};

  if (typeof body.faseAtual === "number") out.faseAtual = body.faseAtual;
  if (typeof body.concluida === "boolean") out.concluida = body.concluida;

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
