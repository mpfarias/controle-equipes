import type { TabKey } from '../constants';
import { TABS, PERMISSION_TABS } from '../constants';

/** Nome do aplicativo exibido na aba do navegador (Órion SAD). */
export const BROWSER_TITLE_APP_SAD = 'Órion SAD';

const rotuloPorChave: Partial<Record<TabKey, string>> = {};

for (const t of PERMISSION_TABS) {
  rotuloPorChave[t.key] = t.label;
}
for (const t of TABS) {
  if (!rotuloPorChave[t.key]) {
    rotuloPorChave[t.key] = t.label;
  }
}

rotuloPorChave['relatorios-sistema'] = 'Relatórios de Auditoria';
rotuloPorChave['relatorios-servico'] = 'Relatórios de Serviço';

/** Rótulo da área principal (aba) para o título do documento. */
export function rotuloAbaPrincipalSAD(tab: TabKey): string {
  return rotuloPorChave[tab] ?? 'Painel';
}

/**
 * Monta o título da aba: `Órion SAD — {contexto}` ou com primeiro nome do usuário.
 */
export function formatDocumentTitleSAD(
  contexto: string,
  options?: { primeiroNomeUsuario?: string },
): string {
  const nome = options?.primeiroNomeUsuario?.trim();
  if (nome) {
    return `${BROWSER_TITLE_APP_SAD} — ${contexto} · ${nome}`;
  }
  return `${BROWSER_TITLE_APP_SAD} — ${contexto}`;
}
