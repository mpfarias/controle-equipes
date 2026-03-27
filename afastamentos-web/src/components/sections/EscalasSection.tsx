import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Box, Paper, Stack, Tab, Tabs } from '@mui/material';
import type { Usuario } from '../../types';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canView } from '../../utils/permissions';
import { useEscalaParametros } from '../../hooks/useEscalaParametros';
import { GerarEscalasTab } from './GerarEscalasTab';
import { VisualizarEscalasTab } from './VisualizarEscalasTab';

interface EscalasSectionProps {
  currentUser: Usuario;
  permissoes?: PermissoesPorTela | null;
}

type EscalasPainelKey = 'gerar' | 'consultar';

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
        <Box sx={{ p: 3, minHeight: 200 }}>{children}</Box>
      )}
    </div>
  );
}

export function EscalasSection({ currentUser, permissoes }: EscalasSectionProps) {
  const { parsed: escalaParsed, error: errorParametros } = useEscalaParametros();
  const [abaEscalas, setAbaEscalas] = useState(0);

  const abasVisiveis = useMemo(() => {
    const list: { key: EscalasPainelKey; label: string }[] = [];
    if (canView(permissoes, 'escalas-gerar')) {
      list.push({ key: 'gerar', label: 'Gerar Escalas' });
    }
    if (canView(permissoes, 'escalas-consultar')) {
      list.push({ key: 'consultar', label: 'Visualizar Escalas' });
    }
    return list;
  }, [permissoes]);

  useEffect(() => {
    if (abaEscalas >= abasVisiveis.length) setAbaEscalas(0);
  }, [abasVisiveis.length, abaEscalas]);

  if (abasVisiveis.length === 0) {
    return (
      <section>
        <div className="section-header">
          <div>
            <h2>Escalas</h2>
            <p className="subtitle">Geração e consulta de escalas operacionais.</p>
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
          <p className="subtitle">Geração e consulta de escalas operacionais.</p>
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
