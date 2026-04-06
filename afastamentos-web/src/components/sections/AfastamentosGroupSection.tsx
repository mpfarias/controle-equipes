import { useState, useEffect } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import type { Usuario } from '../../types';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import type { AfastamentosSubTabKey } from '../../constants';
import { AFastamentosSubTABS } from '../../constants';
import type { PermissoesPorTela } from '../../utils/permissions';
import { DashboardSection } from './DashboardSection';
import { AfastamentosSection } from './AfastamentosSection';
import { GerarRestricaoAfastamentoSection } from './GerarRestricaoAfastamentoSection';

interface AfastamentosGroupSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
  onChanged?: () => void;
  permissoes?: PermissoesPorTela | null;
  initialSubTab?: AfastamentosSubTabKey;
  initialCadastro?: { policialId: number; motivoNome: string } | null;
  onPreencherCadastroConsumed?: () => void;
  /** Atualiza o título da aba do navegador (subárea de Afastamentos). */
  onPainelTituloChange?: (label: string | null) => void;
}

export function AfastamentosGroupSection({
  currentUser,
  openConfirm,
  onChanged,
  permissoes,
  initialSubTab = 'afastamentos',
  initialCadastro,
  onPreencherCadastroConsumed,
  onPainelTituloChange,
}: AfastamentosGroupSectionProps) {
  const [subTabAtiva, setSubTabAtiva] = useState<AfastamentosSubTabKey>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) setSubTabAtiva(initialSubTab);
  }, [initialSubTab]);

  const subTabsVisiveis = AFastamentosSubTABS.filter(
    (st) => Boolean(permissoes?.[st.key]?.VISUALIZAR)
  );

  const subTabIndex = subTabsVisiveis.findIndex((st) => st.key === subTabAtiva);
  const subTabAtual: AfastamentosSubTabKey =
    subTabIndex >= 0 ? subTabAtiva : subTabsVisiveis[0]?.key ?? 'afastamentos-mes';

  useEffect(() => {
    if (!onPainelTituloChange) return;
    const vis = AFastamentosSubTABS.filter((st) => Boolean(permissoes?.[st.key]?.VISUALIZAR));
    if (vis.length === 0) {
      onPainelTituloChange(null);
      return;
    }
    const idx = vis.findIndex((st) => st.key === subTabAtiva);
    const keyEfetivo: AfastamentosSubTabKey = idx >= 0 ? subTabAtiva : vis[0]!.key;
    const st = vis.find((s) => s.key === keyEfetivo);
    onPainelTituloChange(st?.label ?? null);
  }, [subTabAtiva, permissoes, onPainelTituloChange]);

  if (subTabsVisiveis.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        Você não tem permissão para visualizar nenhuma tela de afastamentos.
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs
          value={subTabIndex >= 0 ? subTabIndex : 0}
          onChange={(_, index) => setSubTabAtiva(subTabsVisiveis[index].key)}
        >
          {subTabsVisiveis.map((st) => (
            <Tab key={st.key} label={st.label} />
          ))}
        </Tabs>
      </Box>
      <Box sx={{ p: 2 }}>
        {subTabAtual === 'afastamentos-mes' && (
          <DashboardSection currentUser={currentUser} />
        )}
        {subTabAtual === 'afastamentos' && (
          <AfastamentosSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onChanged={onChanged}
            permissoes={permissoes}
            initialCadastro={initialCadastro}
            onPreencherCadastroConsumed={onPreencherCadastroConsumed}
          />
        )}
        {subTabAtual === 'restricao-afastamento' && (
          <GerarRestricaoAfastamentoSection
            openConfirm={openConfirm}
            permissoes={permissoes}
          />
        )}
      </Box>
    </Box>
  );
}
