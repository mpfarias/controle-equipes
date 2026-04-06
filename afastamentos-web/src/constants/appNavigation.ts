import type { TabKey } from './index';

export const ORIAN_NAVIGATE_TAB = 'orian-navigate-tab';

export type NavigateTabEventDetail = {
  tab: TabKey;
  /** Ao ir para Reportar erro, rolar até o formulário e focar o primeiro campo. */
  focusChamadoForm?: boolean;
};

export function dispatchNavigateTab(detail: NavigateTabEventDetail): void {
  window.dispatchEvent(new CustomEvent(ORIAN_NAVIGATE_TAB, { detail }));
}
