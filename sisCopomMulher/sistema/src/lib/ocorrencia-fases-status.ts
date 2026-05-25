/**
 * Indicadores de preenchimento das 3 fases do cadastro (alinhado ao OcorrenciaWizard).
 * Regras:
 * - Fase 1 OK se mais de 70% dos campos da fase 1 estiverem preenchidos.
 * - Fase 2 OK com 2 campos obrigatórios: comandante/viatura e responsável.
 *   "Detalhes do encaminhamento" é opcional (pode ficar em branco).
 * - Fase 3 exige 100% dos 3 campos.
 */

export type OcorrenciaFasesRowInput = {
  dataHoraOcorrencia: Date | string | null;
  nomeVitima: string | null;
  cpfVitima: string | null;
  dataNascimentoVitima: Date | string | null;
  genitoraVitima: string | null;
  enderecoVitima: string | null;
  telefoneVitima: string | null;
  pontoReferencia: string | null;
  regiaoAdministrativa: string | null;
  historicoOcorrencia: string | null;
  nomeAgressor: string | null;
  enderecoAgressor: string | null;
  parentescoAgressorVitima: string | null;
  tipoAmeacaAgressao: string | null;
  agressorEnvolvimento: string | null;
  idadeAgressor: string | null;
  comandanteViatura: string | null;
  responsavelAtendimento: string | null;
  encaminhamentoDetalhes: string | null;
  desfecho: string | null;
  registrouBoDp: string | null;
  numeroOcorrenciaCad: string | null;
};

function strOk(v: string | null | undefined): boolean {
  return Boolean(v != null && String(v).trim());
}

function dateOk(v: Date | string | null | undefined): boolean {
  if (v == null) return false;
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  const d = new Date(String(v));
  return !Number.isNaN(d.getTime());
}

/** Limiar da fase 1: estritamente mais de 70% dos campos preenchidos. */
export const FASE1_LIMIAR_PREENCHIMENTO = 0.7;

export type FaseIndicador = {
  fase: 1 | 2 | 3;
  completa: boolean;
  /** Rótulos amigáveis para tooltip (campos em falta nas fases 2/3; na fase 1, só quando incompleta). */
  pendentes: string[];
  /** Só fase 1: percentual 0–100 dos campos da fase 1 preenchidos. */
  percentPreenchimentoFase1?: number;
};

const ROTULO_FASE1: Record<string, string> = {
  dataHoraOcorrencia: "Data/hora da ocorrência",
  nomeVitima: "Nome da vítima",
  cpfVitima: "CPF da vítima",
  dataNascimentoVitima: "Data de nascimento da vítima",
  genitoraVitima: "Genitora da vítima",
  enderecoVitima: "Endereço da vítima",
  telefoneVitima: "Telefone da vítima",
  pontoReferencia: "Ponto de referência",
  regiaoAdministrativa: "Região administrativa",
  historicoOcorrencia: "Histórico da ocorrência",
  nomeAgressor: "Nome do agressor",
  enderecoAgressor: "Endereço do agressor",
  parentescoAgressorVitima: "Parentesco agressor × vítima",
  tipoAmeacaAgressao: "Tipo de ameaça ou agressão",
  agressorEnvolvimento: "Envolvimento do agressor",
  idadeAgressor: "Idade do agressor",
};

function campoFase1Preenchido(row: OcorrenciaFasesRowInput, k: keyof typeof ROTULO_FASE1): boolean {
  const val = row[k as keyof OcorrenciaFasesRowInput];
  return k === "dataHoraOcorrencia" || k === "dataNascimentoVitima"
    ? dateOk(val as Date | string | null)
    : strOk(val as string | null);
}

export function indicadoresFasesCadastro(row: OcorrenciaFasesRowInput): FaseIndicador[] {
  const f1Keys = Object.keys(ROTULO_FASE1) as (keyof typeof ROTULO_FASE1)[];
  const totalFase1 = f1Keys.length;
  let preenchidosFase1 = 0;
  const pendentes1: string[] = [];
  for (const k of f1Keys) {
    if (campoFase1Preenchido(row, k)) {
      preenchidosFase1 += 1;
    } else {
      pendentes1.push(ROTULO_FASE1[k]);
    }
  }
  const ratioFase1 = totalFase1 > 0 ? preenchidosFase1 / totalFase1 : 0;
  const percentFase1 = Math.round(ratioFase1 * 1000) / 10;
  const fase1Ok = ratioFase1 > FASE1_LIMIAR_PREENCHIMENTO;

  const pendentes2: string[] = [];
  if (!strOk(row.comandanteViatura)) pendentes2.push("Comandante / viatura");
  if (!strOk(row.responsavelAtendimento)) pendentes2.push("Responsável pelo atendimento");

  const pendentes3: string[] = [];
  if (!strOk(row.desfecho)) pendentes3.push("Desfecho");
  if (!strOk(row.registrouBoDp)) pendentes3.push("Registrou BO na DP?");
  if (!strOk(row.numeroOcorrenciaCad)) pendentes3.push("Número ocorrência CAD");

  return [
    {
      fase: 1,
      completa: fase1Ok,
      pendentes: fase1Ok ? [] : pendentes1,
      percentPreenchimentoFase1: percentFase1,
    },
    { fase: 2, completa: pendentes2.length === 0, pendentes: pendentes2 },
    { fase: 3, completa: pendentes3.length === 0, pendentes: pendentes3 },
  ];
}

export function tituloTooltipFase(ind: FaseIndicador): string {
  if (ind.fase === 1 && ind.percentPreenchimentoFase1 != null) {
    const pct = ind.percentPreenchimentoFase1;
    const lim = Math.round(FASE1_LIMIAR_PREENCHIMENTO * 100);
    if (ind.completa) {
      return `Fase 1 — OK (${pct}% do cadastro da fase 1; exigido mais de ${lim}%)`;
    }
    const max = 8;
    const lista = ind.pendentes.slice(0, max).join("; ");
    const mais = ind.pendentes.length > max ? ` (+${ind.pendentes.length - max})` : "";
    return `Fase 1 — ${pct}% preenchido (mínimo mais de ${lim}%). Em falta: ${lista}${mais}`;
  }
  if (ind.completa) return `Fase ${ind.fase} — todos os campos preenchidos`;
  const max = 8;
  const lista = ind.pendentes.slice(0, max).join("; ");
  const mais = ind.pendentes.length > max ? ` (+${ind.pendentes.length - max})` : "";
  return `Fase ${ind.fase} — pendente: ${lista}${mais}`;
}
