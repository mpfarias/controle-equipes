import type { Usuario } from '../../types';
import { ReportarErroView } from '../../error-reports/ReportarErroView';

interface ReportarErroSectionProps {
  currentUser: Usuario;
  /** Incrementado ao acionar "Abrir chamado" para rolar até o formulário. */
  focusChamadoFormSeq?: number;
}

export function ReportarErroSection({
  currentUser,
  focusChamadoFormSeq = 0,
}: ReportarErroSectionProps) {
  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Reportar erro</h2>
          <p className="subtitle">
            O formulário de novo chamado fica oculto até você clicar em Abrir chamado. A lista e o histórico de
            ações aparecem abaixo.
          </p>
        </div>
      </div>

      <ReportarErroView currentUser={currentUser} focusChamadoFormSeq={focusChamadoFormSeq} />
    </section>
  );
}
