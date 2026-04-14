import type { EscalasSubTabKey, TabKey } from './index';

export const ORIAN_NAVIGATE_TAB = 'orian-navigate-tab';

export type NavigateTabEventDetail = {
  tab: TabKey;
  /** Ao ir para Reportar erro, rolar até o formulário e focar o primeiro campo. */
  focusChamadoForm?: boolean;
  /** Ao ir para Escalas, qual subaba abrir (se o usuário tiver permissão). */
  escalasSubTab?: EscalasSubTabKey;
};

export function dispatchNavigateTab(detail: NavigateTabEventDetail): void {
  window.dispatchEvent(new CustomEvent(ORIAN_NAVIGATE_TAB, { detail }));
}
