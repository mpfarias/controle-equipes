import { getUrlOrionJuridico } from '../constants/orionJuridico';
import { getUrlOrionPatrimonio } from '../constants/orionPatrimonio';
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
 * Destinos para o menu do avatar (exceto o app atual, Órion Qualidade).
 * Alinhado ao padrão do SAD: SAD, Órion Patrimônio (handoff), Operações, Jurídico, Suporte — conforme permissão e URL configurada.
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

  if (temAcessoOrionSuporteEfetivo(usuario)) {
    const u = getUrlOrionSuporte();
    if (u) {
      out.push({ id: SISTEMA_ID_SUPORTE, label: 'Órion Suporte', url: u });
    }
  }

  return out;
}
