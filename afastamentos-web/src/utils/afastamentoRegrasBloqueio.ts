import type { Afastamento } from '../types';

/**
 * Indica se o afastamento entra em bloqueios de sobreposição, limites e conflitos.
 * Alinhado a `buildWhereAfastamentosBloqueantes` na API.
 */
export function afastamentoInterfereNasRegrasDoSistema(
  afastamento: Pick<Afastamento, 'status' | 'desativadoPorId' | 'desativadoPorNome'>,
): boolean {
  if (afastamento.status === 'DESATIVADO') return false;
  if (afastamento.status === 'ATIVO') return true;
  if (afastamento.status === 'ENCERRADO') {
    if (afastamento.desativadoPorId != null) return false;
    const por = afastamento.desativadoPorNome?.trim();
    if (por && por !== 'Sistema') return false;
    return true;
  }
  return true;
}
