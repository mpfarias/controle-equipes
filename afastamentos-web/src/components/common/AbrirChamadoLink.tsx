import { getUrlAbrirChamado } from '../../constants/suporte';
import { dispatchNavigateTab } from '../../constants/appNavigation';

export interface AbrirChamadoLinkProps {
  /** Card mais estreito (ex.: cabeçalho da Gestão do Sistema). */
  compact?: boolean;
  /** Chamado antes de navegar (ex.: exibir o formulário na hora na tela Reportar erro). */
  onAbrirChamado?: () => void;
}

export function AbrirChamadoLink({ compact = false, onAbrirChamado }: AbrirChamadoLinkProps) {
  const url = getUrlAbrirChamado();
  const baseClass = `abrir-chamado-card${compact ? ' abrir-chamado-card--compact' : ''}`;

  const content = (
    <>
      <span className="abrir-chamado-card__eyebrow">Suporte técnico</span>
      <span className="abrir-chamado-card__title">Abrir chamado</span>
      <span className="abrir-chamado-card__desc">
        Exibe o formulário para registrar seu chamado no Órion.
      </span>
    </>
  );

  return (
    <div className={compact ? 'abrir-chamado-wrap abrir-chamado-wrap--compact' : 'abrir-chamado-wrap'}>
      <button
        type="button"
        className={baseClass}
        onClick={() => {
          onAbrirChamado?.();
          dispatchNavigateTab({ tab: 'reportar-erro', focusChamadoForm: true });
        }}
      >
        {content}
      </button>
      {url ? (
        <a
          className="abrir-chamado-institutional-link"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Abrir também no sistema institucional (nova aba)
        </a>
      ) : null}
    </div>
  );
}
