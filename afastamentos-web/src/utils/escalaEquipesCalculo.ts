import type { EscalaParsed } from './escalaParametros';

const DATA_MIN_CALENDARIO = new Date(2026, 0, 1);

/** Equipes de serviço diurno e noturno na escala operacional 12×24. */
export function calcularEquipesOperacionalDia(
  ano: number,
  mes: number,
  dia: number,
  escala: EscalaParsed,
): { equipeDia: string; equipeNoite: string } | null {
  const dataAtual = new Date(ano, mes, dia);
  if (dataAtual.getTime() < DATA_MIN_CALENDARIO.getTime()) return null;
  const dataInicio = escala.dataInicioEquipes;
  const sequencia = escala.sequenciaEquipes;
  const n = sequencia.length;
  if (n === 0) return null;
  const diffTime = dataAtual.getTime() - dataInicio.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const posicaoDia = ((diffDays % n) + n) % n;
  const posicaoNoite = (posicaoDia - 1 + n) % n;
  return { equipeDia: sequencia[posicaoDia], equipeNoite: sequencia[posicaoNoite] };
}

export function calcularEquipeMotoristasDia(
  ano: number,
  mes: number,
  dia: number,
  escala: EscalaParsed,
): string | null {
  const dataAtual = new Date(ano, mes, dia);
  if (dataAtual.getTime() < DATA_MIN_CALENDARIO.getTime()) return null;
  const seq = escala.sequenciaMotoristas;
  const nm = seq.length;
  if (nm === 0) return null;
  const diffTime = dataAtual.getTime() - escala.dataInicioMotoristas.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  return seq[diffDays % nm];
}
