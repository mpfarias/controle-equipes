import type { Equipe, FuncaoExpedienteHorarioPreset, FuncaoOption } from '../types';

/** Função com expediente 12×36 (semanas ISO alternadas); exige fase PAR/IMPAR no cadastro do policial. */
export function funcaoRequerFase12x36Expediente(
  f: Pick<FuncaoOption, 'escalaExpediente' | 'expedienteHorarioPreset'> | undefined,
): boolean {
  const p = f?.expedienteHorarioPreset;
  return (
    f?.escalaExpediente === true &&
    (p === 'SEG_SEX_12X36_SEMANA_ALTERNADA' || p === 'GUARDA_COPOM_12X36')
  );
}

/** Rótulo da fase PAR/IMPAR na visualização ou no formulário do policial. */
export function labelFase12x36Policial(
  fase: 'PAR' | 'IMPAR',
  preset?: FuncaoExpedienteHorarioPreset | null,
): string {
  if (preset === 'GUARDA_COPOM_12X36') {
    return fase === 'PAR'
      ? 'PAR — seg/qua/sex na semana de referência (18/05/2026)'
      : 'IMPAR — ter/qui na semana de referência (18/05/2026)';
  }
  return fase === 'PAR' ? 'Semanas ISO pares' : 'Semanas ISO ímpares';
}

/** Funções que historicamente não usam equipe (mantido até todos os registros usarem `vinculoEquipe`). */
export function funcaoOcultaCampoEquipe(f: Pick<FuncaoOption, 'nome' | 'vinculoEquipe'> | undefined): boolean {
  if (!f) return false;
  if (f.vinculoEquipe === 'SEM_EQUIPE') return true;
  const u = (f.nome ?? '').toUpperCase();
  return (
    u.includes('EXPEDIENTE ADM') ||
    u.includes('CMT UPM') ||
    u.includes('SUBCMT UPM') ||
    (u.includes('GUARDA') && u.includes('COPOM'))
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
