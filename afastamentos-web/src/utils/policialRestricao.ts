import type { Policial } from '../types';

/**
 * Indica se o policial possui restrição ativa no cadastro (vínculo ao catálogo de restrições de serviço).
 * Qualquer tipo cadastrado nesse catálogo usa o mesmo campo `restricaoMedicaId`.
 */
export function policialPossuiRestricaoCadastrada(p: Policial): boolean {
  return p.restricaoMedicaId != null && p.restricaoMedicaId !== undefined;
}
