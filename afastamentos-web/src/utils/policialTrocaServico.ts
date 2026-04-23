import type { Policial, TrocaServicoAtivaListaItem } from '../types';

/** Função cadastrada como motorista de dia (nome contém "MOTORISTA DE DIA"). */
export function policialEhMotoristaDeDia(p: Policial): boolean {
  const fn = p.funcao?.nome?.toUpperCase() ?? '';
  return fn.includes('MOTORISTA DE DIA');
}

/** Mesma regra que `policialEhMotoristaDeDia`, usando só o nome da função (ex.: item de lista de trocas). */
export function funcaoNomeEhMotoristaDeDia(funcaoNome: string | null | undefined): boolean {
  return (funcaoNome ?? '').toUpperCase().includes('MOTORISTA DE DIA');
}

/** Troca livre motorista ↔ motorista (ambos com função motorista de dia). */
export function trocaServicoAtivaEhEntreMotoristasDeDia(row: TrocaServicoAtivaListaItem): boolean {
  return funcaoNomeEhMotoristaDeDia(row.policialA.funcaoNome) && funcaoNomeEhMotoristaDeDia(row.policialB.funcaoNome);
}

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
