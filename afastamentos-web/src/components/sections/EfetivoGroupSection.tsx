import { useState, useEffect } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import type { Usuario } from '../../types';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import type { EfetivoSubTabKey } from '../../constants';
import { EfetivoSubTABS } from '../../constants';
import type { PermissoesPorTela } from '../../utils/permissions';
import { MostrarEquipeSection } from './MostrarEquipeSection';
import { PoliciaisSection } from './PoliciaisSection';

interface EfetivoGroupSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
  onChanged?: () => void;
  refreshKey?: number;
  permissoes?: PermissoesPorTela | null;
  initialSubTab?: EfetivoSubTabKey;
}

export function EfetivoGroupSection({
  currentUser,
  openConfirm,
  onChanged,
  refreshKey,
  permissoes,
  initialSubTab = 'equipe',
}: EfetivoGroupSectionProps) {
  const [subTabAtiva, setSubTabAtiva] = useState<EfetivoSubTabKey>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) setSubTabAtiva(initialSubTab);
  }, [initialSubTab]);

  const subTabsVisiveis = EfetivoSubTABS.filter(
    (st) => Boolean(permissoes?.[st.key]?.VISUALIZAR)
  );

  const subTabIndex = subTabsVisiveis.findIndex((st) => st.key === subTabAtiva);
  const subTabAtual: EfetivoSubTabKey =
    subTabIndex >= 0 ? subTabAtiva : subTabsVisiveis[0]?.key ?? 'equipe';

  if (subTabsVisiveis.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        Você não tem permissão para visualizar nenhuma tela de efetivo.
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
        {subTabAtual === 'equipe' && (
          <MostrarEquipeSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onChanged={onChanged}
            refreshKey={refreshKey}
            permissoes={permissoes}
          />
        )}
        {subTabAtual === 'policiais' && (
          <PoliciaisSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onChanged={onChanged}
            permissoes={permissoes}
          />
        )}
      </Box>
    </Box>
  );
}
