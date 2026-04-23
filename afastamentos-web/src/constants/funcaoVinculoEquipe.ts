import type { Equipe, FuncaoOption } from '../types';

/** Função com expediente 12×36 (semanas ISO alternadas); exige fase PAR/IMPAR no cadastro do policial. */
export function funcaoRequerFase12x36Expediente(
  f: Pick<FuncaoOption, 'escalaExpediente' | 'expedienteHorarioPreset'> | undefined,
): boolean {
  return f?.escalaExpediente === true && f?.expedienteHorarioPreset === 'SEG_SEX_12X36_SEMANA_ALTERNADA';
}

/** Funções que historicamente não usam equipe (mantido até todos os registros usarem `vinculoEquipe`). */
export function funcaoOcultaCampoEquipe(f: Pick<FuncaoOption, 'nome' | 'vinculoEquipe'> | undefined): boolean {
  if (!f) return false;
  if (f.vinculoEquipe === 'SEM_EQUIPE') return true;
  const u = (f.nome ?? '').toUpperCase();
  return (
    u.includes('EXPEDIENTE ADM') ||
    u.includes('CMT UPM') ||
    u.includes('SUBCMT UPM')
  );
}

/** Se true, o formulário de policial deve exigir equipe (select obrigatório). */
export function funcaoEquipeObrigatoriaNoFormulario(f: Pick<FuncaoOption, 'nome' | 'vinculoEquipe'> | undefined): boolean {
  if (!f) return false;
  if (funcaoOcultaCampoEquipe(f)) return false;
  return f.vinculoEquipe !== 'OPCIONAL';
}

/**
 * Equipe persistida ao criar/editar policial, alinhada à função e às regras de motorista de dia.
 */
export function resolveEquipeParaPolicial(
  funcao: Pick<FuncaoOption, 'nome' | 'vinculoEquipe'> | undefined,
  formEquipe: Equipe | undefined,
  currentUserEquipe: string | null | undefined,
): Equipe | null {
  if (!funcao) {
    return (formEquipe ?? (currentUserEquipe as Equipe | undefined)) || null;
  }
  const nomeUpper = funcao.nome.toUpperCase();
  if (funcaoOcultaCampoEquipe(funcao)) {
    return null;
  }
  if (funcao.vinculoEquipe === 'OPCIONAL') {
    let e: Equipe | null = formEquipe ?? null;
    if (nomeUpper.includes('MOTORISTA DE DIA') && e === 'E') e = null;
    return e;
  }
  let equipeTemp: Equipe | null = formEquipe || (currentUserEquipe as Equipe) || null;
  if (nomeUpper.includes('MOTORISTA DE DIA') && equipeTemp === 'E') {
    equipeTemp = null;
  }
  return equipeTemp;
}
