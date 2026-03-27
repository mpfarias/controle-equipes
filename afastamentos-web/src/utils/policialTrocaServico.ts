import type { Policial } from '../types';

/** Troca de serviço: apenas quem tem equipe operacional (não SEM_EQUIPE) ou função motorista de dia. */
export function policialElegivelTrocaServico(p: Policial): boolean {
  const fn = p.funcao?.nome?.toUpperCase() ?? '';
  const motorista = fn.includes('MOTORISTA DE DIA');
  const eq = p.equipe?.trim() ?? '';
  const equipeOperacional = Boolean(eq && eq !== 'SEM_EQUIPE');

  // Alguns status possuem direito de participar da troca mesmo sem equipe operacional.
  const status = p.status;
  const statusPermiteTroca = status === 'DESIGNADO' || status === 'PTTC' || status === 'COMISSIONADO';

  return statusPermiteTroca || equipeOperacional || motorista;
}
