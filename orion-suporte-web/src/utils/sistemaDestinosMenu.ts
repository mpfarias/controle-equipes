import { getUrlOrionJuridico } from '../constants/orionJuridico';
import { getUrlOrionPatrimonio } from '../constants/orionPatrimonio';
import { getUrlOrionQualidade } from '../constants/orionQualidade';
import { getUrlOrionSAD } from '../constants/orionSAD';
import type { Usuario } from '../types';
import { usuarioPodeAcessarOrionQualidade, usuarioPodeAcessarOrionSAD } from './sistemaAccess';

const SISTEMA_ID_JURIDICO = 'ORION_JURIDICO';

function idsSistemasExplicitos(usuario: Usuario): Set<string> {
  const raw = usuario.sistemasPermitidos;
  if (!Array.isArray(raw) || raw.length === 0) {
    return new Set<string>();
  }
  return new Set(raw.map((s) => String(s).trim().toUpperCase()).filter(Boolean));
}

function envUrl(key: string): string {
  const v = import.meta.env[key as keyof ImportMeta['env']];
  return typeof v === 'string' ? v.trim().replace(/\/+$/, '') : '';
}

export type MenuOutroSistemaItem = {
  id: string;
  label: string;
  url: string;
};

/**
 * Destinos para o menu do avatar (exceto o app atual, Órion Suporte).
 * Alinhado ao SAD e ao Órion Qualidade: SAD, Órion Patrimônio (handoff), Operações, Qualidade, Jurídico.
 */
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

  const urlOpe = envUrl('VITE_SISTEMA_URL_OPERACOES');
  if (explicit.has('OPERACOES') && urlOpe) {
    out.push({ id: 'OPERACOES', label: 'Órion Operações', url: urlOpe });
  }

  if (usuarioPodeAcessarOrionQualidade(usuario)) {
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

  return out;
}
