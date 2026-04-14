import { getUrlOrionJuridico } from '../constants/orionJuridico';
import { getUrlOrionMulher } from '../constants/orionMulher';
import { getUrlOrionQualidade } from '../constants/orionQualidade';
import { getUrlOrionSAD } from '../constants/orionSAD';
import { getUrlOrionSuporte } from '../constants/orionSuporte';
import type { Usuario } from '../types';
import { temAcessoOrionSuporteEfetivo } from './orionSuporteEfetivo';
import { usuarioPodeAcessarOrionSAD } from './sistemaAccess';

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

/** Destinos no menu do avatar (exceto o app atual). */
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

  if (explicit.has('ORION_MULHER')) {
    const u = getUrlOrionMulher();
    if (u) {
      out.push({ id: 'ORION_MULHER', label: 'Órion Mulher', url: u });
    }
  }

  if (temAcessoOrionSuporteEfetivo(usuario)) {
    const u = getUrlOrionSuporte();
    if (u) {
      out.push({ id: 'ORION_SUPORTE', label: 'Órion Suporte', url: u });
    }
  }

  return out;
}
