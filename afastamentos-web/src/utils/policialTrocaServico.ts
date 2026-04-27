import type { Policial, TrocaServicoAtivaListaItem } from '../types';
import { nomeFuncaoIndicaExpedienteAdministrativo } from './gerarEscalasCalculo';

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

/**
 * Expediente ADM, CMT UPM e SubCMT UPM (critério igual ao das escalas) **não** participam de troca de serviço.
 */
export function policialFuncaoExcluiTrocaDeServico(p: Policial): boolean {
  return nomeFuncaoIndicaExpedienteAdministrativo(p.funcao?.nome);
}

/**
 * Troca de serviço: apenas quem tem equipe operacional (não SEM_EQUIPE) ou função motorista de dia,
 * exceto funções Expediente ADM / CMT UPM / SubCMT UPM (sempre excluídas).
 */
export function policialElegivelTrocaServico(p: Policial): boolean {
  if (policialFuncaoExcluiTrocaDeServico(p)) return false;

  const fn = p.funcao?.nome?.toUpperCase() ?? '';
  const motorista = fn.includes('MOTORISTA DE DIA');
  const eq = p.equipe?.trim() ?? '';
  const equipeOperacional = Boolean(eq && eq !== 'SEM_EQUIPE');

  const status = p.status;
  const statusPermiteTroca = status === 'DESIGNADO' || status === 'PTTC' || status === 'COMISSIONADO';

  return statusPermiteTroca || equipeOperacional || motorista;
}
