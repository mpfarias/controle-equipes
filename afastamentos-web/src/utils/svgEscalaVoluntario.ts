import type { Policial } from '../types';
import { SVG_DURACAO_HORAS } from '../constants/svgRegras';
import type { BlocoEscalaId } from './escalaBlocos';
import { formatoRelogioUm } from './expedienteEscalaRegras';

/** Opções de tipo de SVG voluntário (valor persistido na geração / resumo). */
export const SVG_TIPO_VOLUNTARIO_OPCOES: { value: string; label: string }[] = [
  { value: '', label: 'Selecione o tipo' },
  { value: 'DESPACHO_ATENDIMENTO', label: 'Despacho/Atendimento' },
  { value: 'OFICIAL_OPERACOES', label: 'Oficial de operações' },
];

export type SvgEscalaLinhaVoluntario = {
  policialId: number;
  horaInicio: string;
  horaFim: string;
  cruzaMeiaNoite: boolean;
};

export type SvgEscalaConfig = {
  tipoSvg: string;
  linhas: SvgEscalaLinhaVoluntario[];
};

/** Horas cheias disponíveis para início do SVG (00:00–23:00). */
export function horasInicioSvgOpcoes(): string[] {
  const horas: string[] = [];
  for (let h = 0; h <= 23; h++) {
    horas.push(`${String(h).padStart(2, '0')}:00`);
  }
  return horas;
}

/** Fim do serviço = início + 8 horas (pode cruzar meia-noite). */
export function calcularFimSvgVoluntario(horaInicio: string): {
  horaFim: string;
  cruzaMeiaNoite: boolean;
} {
  const [h, m] = horaInicio.split(':').map((x) => parseInt(x, 10));
  const inicioMin = h * 60 + (m || 0);
  const fimMinTotal = inicioMin + SVG_DURACAO_HORAS * 60;
  const cruzaMeiaNoite = fimMinTotal >= 24 * 60;
  const fimMin = fimMinTotal % (24 * 60);
  const fh = Math.floor(fimMin / 60);
  const fm = fimMin % 60;
  return {
    horaFim: `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`,
    cruzaMeiaNoite,
  };
}

/** Bloco de impressão conforme horário de início / período noturno. */
export function blocoSvgParaVoluntario(linha: Pick<SvgEscalaLinhaVoluntario, 'horaInicio' | 'cruzaMeiaNoite'>): BlocoEscalaId {
  const h = parseInt(linha.horaInicio.split(':')[0], 10);
  if (linha.cruzaMeiaNoite || h >= 20 || h < 4) return 'SVG_20_04';
  if (h >= 15) return 'SVG_15_23';
  return 'SVG_10_18';
}

export function formatarHorarioServicoSvgLinha(linha: SvgEscalaLinhaVoluntario): string {
  const ini = formatoRelogioUm(linha.horaInicio);
  const fim = formatoRelogioUm(linha.horaFim);
  if (linha.cruzaMeiaNoite) {
    return `${ini} (dia da escala)–${fim} (dia seguinte)`;
  }
  return `${ini}–${fim}`;
}

export function resumoSvgVoluntarioConfig(config: SvgEscalaConfig): string {
  const tipoLabel =
    SVG_TIPO_VOLUNTARIO_OPCOES.find((o) => o.value === config.tipoSvg)?.label ??
    (config.tipoSvg.trim() || '(tipo não informado)');
  return (
    `SVG voluntário — duração ${SVG_DURACAO_HORAS}h · tipo: ${tipoLabel}. ` +
    `${config.linhas.length} policial(is) com horário informado na modal.`
  );
}

export type CandidatoSvgVoluntario = {
  policial: Policial;
  horarioServico: string;
  equipeLabel: string;
  blocoEscala: BlocoEscalaId;
};

export function montarCandidatosSvgVoluntario(
  policiais: Policial[],
  config: SvgEscalaConfig,
): CandidatoSvgVoluntario[] {
  const porId = new Map(policiais.map((p) => [p.id, p]));
  const candidatos: CandidatoSvgVoluntario[] = [];
  const tipoRotulo = config.tipoSvg.trim() || '—';

  for (const linha of config.linhas) {
    const p = porId.get(linha.policialId);
    if (!p) continue;
    candidatos.push({
      policial: p,
      horarioServico: formatarHorarioServicoSvgLinha(linha),
      equipeLabel: `SVG voluntário (tipo ${tipoRotulo})`,
      blocoEscala: blocoSvgParaVoluntario(linha),
    });
  }
  return candidatos;
}
