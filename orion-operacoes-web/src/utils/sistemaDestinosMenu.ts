import { getUrlOrionAssessoria } from '../constants/orionAssessoria';
import { getUrlOrionJuridico } from '../constants/orionJuridico';
import { getUrlOrionMulher } from '../constants/orionMulher';
import { getUrlOrionPatrimonio } from '../constants/orionPatrimonio';
import { getUrlOrionQualidade } from '../constants/orionQualidade';
import { getUrlOrionSAD } from '../constants/orionSAD';
import { getUrlOrionSuporte } from '../constants/orionSuporte';
import type { Usuario } from '../types';
import { temAcessoOrionSuporteEfetivo } from './orionSuporteEfetivo';
import { usuarioPodeAcessarOrionSAD } from './sistemaAccess';

const SISTEMA_ID_JURIDICO = 'ORION_JURIDICO';
const SISTEMA_ID_SUPORTE = 'ORION_SUPORTE';

function idsSistemasExplicitos(usuario: Usuario): Set<string> {
  const raw = usuario.sistemasPermitidos;
  if (!Array.isArray(raw) || raw.length === 0) {
    return new Set<string>();
  }
  return new Set(raw.map((s) => String(s).trim().toUpperCase()).filter(Boolean));
}

export type MenuOutroSistemaItem = {
  id: string;
  label: string;
  url: string;
};

/** Menu do avatar (exceto Órion Operações — este app). */
export function listaMenuOutrosSistemas(usuario: Usuario): MenuOutroSistemaItem[] {
  const explicit = idsSistemasExplicitos(usuario);
  if (explicit.has('PATRIMONIO')) {
    explicit.delete('PATRIMONIO');
    explicit.add('ORION_PATRIMONIO');
  }
  const out: MenuOutroSistemaItem[] = [];

  if (usuarioPodeAcessarOrionSAD(usuario)) {
    out.push({ id: 'SAD', label: 'Órion SAD', url: getUrlOrionSAD() });
  }

  if (explicit.has('ORION_QUALIDADE')) {
    const u = getUrlOrionQualidade();
    if (u) {
      out.push({ id: 'ORION_QUALIDADE', label: 'Órion Qualidade', url: u });
    }
  }

  if (explicit.has(SISTEMA_ID_JURIDICO)) {
    const u = getUrlOrionJuridico();
    if (u) {
      out.push({ id: SISTEMA_ID_JURIDICO, label: 'Órion Jurídico', url: u });
    }
  }

  if (explicit.has('ORION_PATRIMONIO')) {
    const u = getUrlOrionPatrimonio();
    if (u) {
      out.push({ id: 'ORION_PATRIMONIO', label: 'Órion Patrimônio', url: u });
    }
  }

  if (explicit.has('ORION_MULHER')) {
    const u = getUrlOrionMulher();
    if (u) {
      out.push({ id: 'ORION_MULHER', label: 'Órion Mulher', url: u });
    }
  }

  if (explicit.has('ORION_ASSESSORIA')) {
    const u = getUrlOrionAssessoria();
    if (u) {
      out.push({ id: 'ORION_ASSESSORIA', label: 'Órion Assessoria', url: u });
    }
  }

  if (temAcessoOrionSuporteEfetivo(usuario)) {
    const u = getUrlOrionSuporte();
    if (u) {
      out.push({ id: SISTEMA_ID_SUPORTE, label: 'Órion Suporte', url: u });
    }
  }

  return out;
}
