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
 * - Regime de escalas: 6 (seis) horas
 * - Expediente: 1 (uma) hora
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
 * - Expediente: 07:00-15:00
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

/** Expediente administrativo: 07:00-15:00 */
export const EXPEDIENTE_INICIO = '07:00';
export const EXPEDIENTE_FIM = '15:00';
