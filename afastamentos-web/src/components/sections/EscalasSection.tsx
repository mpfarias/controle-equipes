import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Box, Paper, Stack, Tab, Tabs } from '@mui/material';
import type { EscalasSubTabKey } from '../../constants';
import type { Usuario } from '../../types';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canView } from '../../utils/permissions';
import { useEscalaParametros } from '../../hooks/useEscalaParametros';
import { GerarEscalasTab } from './GerarEscalasTab';
import { GerarEscalaExtraTab } from './GerarEscalaExtraTab';
import { QuantitativoExtrasTab } from './QuantitativoExtrasTab';
import { VisualizarEscalasTab } from './VisualizarEscalasTab';
import { ESCALA_MOTORISTA_DIA } from '../../constants/escalaMotoristasDia';

interface EscalasSectionProps {
  currentUser: Usuario;
  permissoes?: PermissoesPorTela | null;
  /** Subaba inicial ao montar ou quando o valor mudar (ex.: vindo do Dashboard). */
  initialSubTab?: EscalasSubTabKey;
  /** Incrementado no App ao re-clicar em «Escalas» ou navegar de novo — força voltar à subaba desejada. */
  subTabSyncNonce?: number;
  /** Atualiza o título da aba do navegador (subárea de Escalas). */
  onPainelTituloChange?: (label: string | null) => void;
}

type EscalasPainelKey = EscalasSubTabKey;

function EscalasTabPanel(props: {
  children?: ReactNode;
  value: number;
  index: number;
  id: string;
  labelledBy: string;
}) {
  const { children, value, index, id, labelledBy } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={id} aria-labelledby={labelledBy}>
      {value === index && (
        <Box sx={{ p: 3, minHeight: 200, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>{children}</Box>
      )}
    </div>
  );
}

export function EscalasSection({
  currentUser,
  permissoes,
  initialSubTab = 'gerar',
  subTabSyncNonce = 0,
  onPainelTituloChange,
}: EscalasSectionProps) {
  const { parsed: escalaParsed, error: errorParametros } = useEscalaParametros();
  const [abaEscalas, setAbaEscalas] = useState(0);

  const abasVisiveis = useMemo(() => {
    const list: { key: EscalasPainelKey; label: string }[] = [];
    if (canView(permissoes, 'escalas-gerar')) {
      list.push({ key: 'gerar', label: 'Gerar Escalas' });
      list.push({ key: 'gerar-extra', label: 'Gerar Escala Extra' });
    }
    if (canView(permissoes, 'escalas-consultar')) {
      list.push({ key: 'consultar', label: 'Visualizar Escalas' });
      list.push({ key: 'quantitativo-extras', label: 'Quantidade de extras' });
    }
    return list;
  }, [permissoes]);

  useEffect(() => {
    const idx = abasVisiveis.findIndex((a) => a.key === initialSubTab);
    if (idx >= 0) setAbaEscalas(idx);
  }, [initialSubTab, abasVisiveis, subTabSyncNonce]);

  useEffect(() => {
    if (abaEscalas >= abasVisiveis.length) setAbaEscalas(0);
  }, [abasVisiveis.length, abaEscalas]);

  useEffect(() => {
    if (!onPainelTituloChange) return;
    if (abasVisiveis.length === 0) {
      onPainelTituloChange(null);
      return;
    }
    const idx = Math.min(abaEscalas, abasVisiveis.length - 1);
    onPainelTituloChange(abasVisiveis[idx]?.label ?? null);
  }, [abaEscalas, abasVisiveis, onPainelTituloChange]);

  if (abasVisiveis.length === 0) {
    return (
      <section>
        <div className="section-header">
          <div>
            <h2>Escalas</h2>
            <p className="subtitle">
              Geração e consulta de escalas: equipes operacionais 12×24 e motorista de dia {ESCALA_MOTORISTA_DIA}.
            </p>
          </div>
        </div>
        <Alert severity="info" sx={{ mt: 2 }}>
          Você não tem permissão para acessar as subáreas de Escalas (Gerar ou Consultar). Peça ao administrador para
          ajustar o nível de acesso.
        </Alert>
      </section>
    );
  }

  const tabValue = abasVisiveis.length > 1 ? abaEscalas : 0;

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Escalas</h2>
          <p className="subtitle">
            Geração e consulta de escalas: equipes operacionais 12×24 e motorista de dia {ESCALA_MOTORISTA_DIA}.
          </p>
        </div>
        <Box sx={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{currentUser.nome}</Box>
      </div>

      <Stack spacing={2} sx={{ mt: 2 }}>
        {errorParametros && (
          <Alert severity="warning">
            Não foi possível carregar os parâmetros da escala no servidor; o cálculo usa valores padrão (como no
            Calendário).
          </Alert>
        )}

        <Paper
          sx={{
            borderRadius: 2,
            border: '1px solid var(--border-soft)',
            backgroundColor: 'var(--card-bg)',
            overflow: 'hidden',
            maxWidth: '100%',
          }}
        >
          {abasVisiveis.length > 1 ? (
            <Tabs
              value={abaEscalas}
              onChange={(_, v) => setAbaEscalas(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                borderBottom: '1px solid var(--border-soft)',
                px: { xs: 0, sm: 1 },
                '& .MuiTab-root': { textTransform: 'none' },
              }}
            >
              {abasVisiveis.map((aba, idx) => (
                <Tab
                  key={aba.key}
                  label={aba.label}
                  id={`escalas-tab-${idx}`}
                  aria-controls={`escalas-panel-${idx}`}
                />
              ))}
            </Tabs>
          ) : null}

          {abasVisiveis.map((aba, idx) => (
            <EscalasTabPanel
              key={aba.key}
              value={tabValue}
              index={idx}
              id={`escalas-panel-${idx}`}
              labelledBy={`escalas-tab-${idx}`}
            >
              {aba.key === 'gerar' ? (
                <GerarEscalasTab escalaParsed={escalaParsed} permissoes={permissoes} />
              ) : aba.key === 'gerar-extra' ? (
                <GerarEscalaExtraTab permissoes={permissoes} />
              ) : aba.key === 'quantitativo-extras' ? (
                <QuantitativoExtrasTab permissoes={permissoes} />
              ) : (
                <VisualizarEscalasTab currentUser={currentUser} permissoes={permissoes} />
              )}
            </EscalasTabPanel>
          ))}
        </Paper>
      </Stack>
    </section>
  );
}
