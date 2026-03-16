/**
 * Regras do SVG (Serviço Voluntário Gratificado) - "voluntário"
 *
 * O voluntário é um serviço especial em que o policial se voluntaria para trabalhar
 * fora do seu horário de trabalho.
 *
 * DURAÇÃO: 8 horas de trabalho
 *
 * LIMITE: Máximo de 10 serviços por mês (validado no cadastro, não na lista de disponibilidade)
 *
 * INTERVALOS OBRIGATÓRIOS (antes e depois do serviço ordinário ou voluntário em relação ao SVG pleiteado):
 * - Regime de escalas: 6 (seis) horas de descanso
 * - Expediente: 1 (uma) hora de descanso
 *
 * O policial só pode fazer o SVG se:
 * - Não estiver trabalhando durante o período [SVG_início - intervalo, SVG_fim + intervalo]
 * - Escalas: 6h antes e 6h depois do SVG
 * - Expediente: 1h antes e 1h depois do SVG
 *
 * IMPEDIMENTOS (não podem ser escalados):
 * - Em gozo de qualquer afastamento
 * - Em dispensa ou licença regulamentar
 * - Em licença para tratamento de saúde própria
 * - Com restrição médica (inclui porte de arma suspenso)
 * - Status DESATIVADO
 * - Status COMISSIONADO
 * - Status PTTC
 *
 * HORÁRIOS DE SERVIÇO (para cálculo dos intervalos):
 * - Escala dia: 07:00-19:00
 * - Escala noite: 19:00-07:00 (próximo dia)
 * - Expediente: varia por dia da semana
 *   - Segunda a quinta: 13:00-19:00
 *   - Sexta: 07:00-13:00
 *   - Sábado, domingo e feriados: sem expediente
 */

export const SVG_DURACAO_HORAS = 8;
export const SVG_LIMITE_MAXIMO_MES = 10;
export const SVG_INTERVALO_ESCALAS_HORAS = 6;
export const SVG_INTERVALO_EXPEDIENTE_HORAS = 1;

/** Escala dia: 07:00-19:00 */
export const ESCALA_DIA_INICIO = '07:00';
export const ESCALA_DIA_FIM = '19:00';

/** Escala noite: 19:00-07:00 (próximo dia) */
export const ESCALA_NOITE_INICIO = '19:00';
export const ESCALA_NOITE_FIM = '07:00';

/** Expediente segunda a quinta: 13:00-19:00 */
export const EXPEDIENTE_SEG_QUI_INICIO = '13:00';
export const EXPEDIENTE_SEG_QUI_FIM = '19:00';

/** Expediente sexta: 07:00-13:00 */
export const EXPEDIENTE_SEXTA_INICIO = '07:00';
export const EXPEDIENTE_SEXTA_FIM = '13:00';

/**
 * Retorna o horário do expediente para uma data, ou null se não há expediente (sábado, domingo, feriado).
 * @param data - Data a verificar
 * @returns { inicio: string, fim: string } ou null
 */
export function getExpedienteHorario(data: Date): { inicio: string; fim: string } | null {
  const diaSemana = data.getDay();
  const dia = data.getDate();
  const mes = data.getMonth();
  const ano = data.getFullYear();

  if (diaSemana === 0 || diaSemana === 6) return null;

  if (isFeriado(dia, mes, ano)) return null;

  if (diaSemana === 5) {
    return { inicio: EXPEDIENTE_SEXTA_INICIO, fim: EXPEDIENTE_SEXTA_FIM };
  }

  return { inicio: EXPEDIENTE_SEG_QUI_INICIO, fim: EXPEDIENTE_SEG_QUI_FIM };
}

function isFeriado(dia: number, mes: number, _ano: number): boolean {
  const feriados: [number, number][] = [
    [1, 0],
    [21, 3],
    [1, 4],
    [7, 8],
    [12, 9],
    [2, 10],
    [15, 10],
    [25, 11],
  ];
  return feriados.some(([d, m]) => d === dia && m === mes);
}
