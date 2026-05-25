import type { Prisma } from "@prisma/client";

function normHeader(h: string) {
  return String(h ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[:_\s]+/g, " ")
    .trim();
}

type RowMap = Record<string, string | number | Date | null | undefined>;

function isNomeVitimaColumn(n: string) {
  if (!n.includes("vitima") || !n.includes("nome")) return false;
  if (n.includes("agressor") || n.includes("denunciante")) return false;
  if (n.includes("cpf") || n.includes("endereco") || n.includes("telefone")) return false;
  if (n.includes("nascimento") || n.includes("genitora")) return false;
  return true;
}

const HEADER_RULES: { match: (n: string) => boolean; key: keyof RowMap }[] = [
  { match: (n) => n.includes("carimbo") && n.includes("data"), key: "carimboDataHora" },
  { match: (n) => isNomeVitimaColumn(n), key: "nomeVitima" },
  { match: (n) => n === "vitima", key: "nomeVitima" },
  { match: (n) => n.includes("endereco") && n.includes("vitima"), key: "enderecoVitima" },
  { match: (n) => n.includes("telefone") && n.includes("vitima") && !n.includes("secund"), key: "telefoneVitima" },
  { match: (n) => n.includes("telefone") && n.includes("vitima") && n.includes("secund"), key: "telefoneVitimaSecundario" },
  { match: (n) => n.includes("data") && n.includes("hora") && n.includes("ocorrenc"), key: "dataHoraOcorrencia" },
  { match: (n) => n.startsWith("nome") && n.includes("agressor"), key: "nomeAgressor" },
  { match: (n) => n.includes("endereco") && n.includes("agressor"), key: "enderecoAgressor" },
  { match: (n) => n.includes("historico") && n.includes("ocorrenc"), key: "historicoOcorrencia" },
  { match: (n) => n.includes("comandante") || n.includes("viatura"), key: "comandanteViatura" },
  { match: (n) => n.includes("desfecho"), key: "desfecho" },
  { match: (n) => n.startsWith("nome") && n.includes("denunciante"), key: "nomeDenunciante" },
  { match: (n) => n.includes("endereco") && n.includes("denunciante"), key: "enderecoDenunciante" },
  { match: (n) => n.includes("telefone") && n.includes("denunciante"), key: "telefoneDenunciante" },
  { match: (n) => n.includes("responsavel") && n.includes("atendimento"), key: "responsavelAtendimento" },
  { match: (n) => n.includes("parentesco"), key: "parentescoAgressorVitima" },
  { match: (n) => n.includes("regiao") && n.includes("administrativa"), key: "regiaoAdministrativa" },
  { match: (n) => n === "regiao", key: "regiaoAdministrativa" },
  {
    match: (n) =>
      n === "fase" ||
      n === "fase atual" ||
      (n.startsWith("fase ") && !n.includes("desfecho")),
    key: "fasePlanilha",
  },
  { match: (n) => n === "cad", key: "numeroOcorrenciaCad" },
  { match: (n) => n.includes("tipo") && (n.includes("ameaca") || n.includes("agress")), key: "tipoAmeacaAgressao" },
  { match: (n) => n.includes("agressor") && n.includes("envolvimento"), key: "agressorEnvolvimento" },
  { match: (n) => n.includes("idade") && n.includes("agressor"), key: "idadeAgressor" },
  { match: (n) => n.includes("registrou") && n.includes("bo"), key: "registrouBoDp" },
  { match: (n) => n.includes("cpf") && n.includes("vitima"), key: "cpfVitima" },
  { match: (n) => n.includes("numero") && n.includes("ocorrenc") && n.includes("cad"), key: "numeroOcorrenciaCad" },
  { match: (n) => n.includes("nascimento") && n.includes("vitima"), key: "dataNascimentoVitima" },
  { match: (n) => n.includes("ponto") && n.includes("refer"), key: "pontoReferencia" },
  { match: (n) => n.includes("genitora"), key: "genitoraVitima" },
  {
    match: (n) =>
      n === "nome" ||
      n === "nome completo" ||
      (n.startsWith("nome completo") && !n.includes("agressor") && !n.includes("denunciante")),
    key: "nomeVitima",
  },
];

function buildHeaderIndex(headers: string[]) {
  const idx: Record<string, number> = {};
  headers.forEach((raw, i) => {
    const n = normHeader(String(raw ?? ""));
    if (!n) return;
    for (const rule of HEADER_RULES) {
      if (rule.match(n)) {
        const k = rule.key as string;
        if (idx[k] === undefined) idx[k] = i;
        break;
      }
    }
  });
  return idx;
}

function asDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function asString(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v) === v ? Math.trunc(v) : v);
  const s = String(v).trim();
  return s.length ? s : null;
}

function pickFirstNonEmptyNomeVitima(headers: string[], row: unknown[]): string | null {
  for (let i = 0; i < headers.length; i++) {
    const n = normHeader(String(headers[i] ?? ""));
    if (!n) continue;
    for (const rule of HEADER_RULES) {
      if (!rule.match(n)) continue;
      if (rule.key === "nomeVitima") {
        const v = asString(row[i]);
        if (v) return v;
      }
      break;
    }
  }
  return null;
}

function parseFaseAtual(v: unknown): number {
  const s = asString(v);
  if (!s) return 1;
  const t = s.trim().toLowerCase();
  const oneDigit = t.match(/\b([1-3])\b/);
  if (oneDigit) return Number(oneDigit[1]);
  const digits = t.replace(/\D/g, "");
  if (digits.length) {
    const n = parseInt(digits.slice(0, 2), 10);
    if (n >= 1 && n <= 3) return n;
    if (n > 3) return 3;
  }
  return 1;
}

/**
 * Importação completa a partir do Excel (todos os campos mapeados).
 * Linhas sem nome da vítima em nenhuma coluna reconhecida são ignoradas (`null`).
 */
export function sheetRowToOccurrence(headers: string[], row: unknown[]): Prisma.OccurrenceCreateInput | null {
  const h = buildHeaderIndex(headers);
  const pick = (key: keyof RowMap) => {
    const col = h[key as string];
    if (col === undefined) return undefined;
    return row[col];
  };

  const nomeVitima = pickFirstNonEmptyNomeVitima(headers, row);
  if (!nomeVitima) return null;

  const carimboDataHora = asDate(pick("carimboDataHora"));
  const dataHoraOcorrencia = asDate(pick("dataHoraOcorrencia"));
  const dataNascimentoVitima = asDate(pick("dataNascimentoVitima"));

  const hasPhase3 =
    asString(pick("desfecho")) ||
    asString(pick("registrouBoDp")) ||
    asString(pick("numeroOcorrenciaCad"));
  const hasPhase2 =
    asString(pick("comandanteViatura")) || asString(pick("responsavelAtendimento"));

  const faseCell = pick("fasePlanilha");
  let faseAtual: number;
  if (asString(faseCell)) {
    faseAtual = parseFaseAtual(faseCell);
  } else {
    faseAtual = 1;
    if (hasPhase2) faseAtual = 2;
    if (hasPhase3) faseAtual = 3;
  }
  const concluida = Boolean(hasPhase3);

  return {
    origem: "IMPORTACAO_EXCEL",
    faseAtual,
    concluida,
    carimboDataHora: carimboDataHora ?? undefined,
    nomeVitima,
    enderecoVitima: asString(pick("enderecoVitima")) ?? undefined,
    telefoneVitima: asString(pick("telefoneVitima")) ?? undefined,
    telefoneVitimaSecundario: asString(pick("telefoneVitimaSecundario")) ?? undefined,
    cpfVitima: asString(pick("cpfVitima")) ?? undefined,
    dataNascimentoVitima: dataNascimentoVitima ?? undefined,
    genitoraVitima: asString(pick("genitoraVitima")) ?? undefined,
    pontoReferencia: asString(pick("pontoReferencia")) ?? undefined,
    dataHoraOcorrencia: dataHoraOcorrencia ?? undefined,
    regiaoAdministrativa: asString(pick("regiaoAdministrativa")) ?? undefined,
    historicoOcorrencia: asString(pick("historicoOcorrencia")) ?? undefined,
    nomeAgressor: asString(pick("nomeAgressor")) ?? undefined,
    enderecoAgressor: asString(pick("enderecoAgressor")) ?? undefined,
    parentescoAgressorVitima: asString(pick("parentescoAgressorVitima")) ?? undefined,
    tipoAmeacaAgressao: asString(pick("tipoAmeacaAgressao")) ?? undefined,
    agressorEnvolvimento: asString(pick("agressorEnvolvimento")) ?? undefined,
    idadeAgressor: asString(pick("idadeAgressor")) ?? undefined,
    nomeDenunciante: asString(pick("nomeDenunciante")) ?? undefined,
    enderecoDenunciante: asString(pick("enderecoDenunciante")) ?? undefined,
    telefoneDenunciante: asString(pick("telefoneDenunciante")) ?? undefined,
    comandanteViatura: asString(pick("comandanteViatura")) ?? undefined,
    responsavelAtendimento: asString(pick("responsavelAtendimento")) ?? undefined,
    desfecho: asString(pick("desfecho")) ?? undefined,
    registrouBoDp: asString(pick("registrouBoDp")) ?? undefined,
    numeroOcorrenciaCad: asString(pick("numeroOcorrenciaCad")) ?? undefined,
  };
}
