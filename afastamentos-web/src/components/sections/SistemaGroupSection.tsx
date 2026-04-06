import { useState, useEffect } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import type { Usuario } from '../../types';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import type { SistemaSubTabKey } from '../../constants';
import { SistemaSubTABS } from '../../constants';
import type { PermissoesPorTela } from '../../utils/permissions';
import { UsuariosSection } from './UsuariosSection';
import { GestaoSistemaSection } from './GestaoSistemaSection';
import { RelatoriosSection } from './RelatoriosSection';

interface SistemaGroupSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
  onCurrentUserUpdate?: (updatedUser: Usuario) => void;
  permissoes?: PermissoesPorTela | null;
  initialSubTab?: SistemaSubTabKey;
  /** Atualiza o título da aba do navegador (subárea de Sistema). */
  onPainelTituloChange?: (label: string | null) => void;
}

export function SistemaGroupSection({
  currentUser,
  openConfirm,
  onCurrentUserUpdate,
  permissoes,
  initialSubTab = 'usuarios',
  onPainelTituloChange,
}: SistemaGroupSectionProps) {
  const [subTabAtiva, setSubTabAtiva] = useState<SistemaSubTabKey>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) setSubTabAtiva(initialSubTab);
  }, [initialSubTab]);

  const subTabsVisiveis = SistemaSubTABS.filter(
    (st) => Boolean(permissoes?.[st.key]?.VISUALIZAR)
  );

  const subTabIndex = subTabsVisiveis.findIndex((st) => st.key === subTabAtiva);
  const subTabAtual: SistemaSubTabKey =
    subTabIndex >= 0 ? subTabAtiva : subTabsVisiveis[0]?.key ?? 'usuarios';

  useEffect(() => {
    if (!onPainelTituloChange) return;
    const vis = SistemaSubTABS.filter((st) => Boolean(permissoes?.[st.key]?.VISUALIZAR));
    if (vis.length === 0) {
      onPainelTituloChange(null);
      return;
    }
    const idx = vis.findIndex((st) => st.key === subTabAtiva);
    const keyEfetivo: SistemaSubTabKey = idx >= 0 ? subTabAtiva : vis[0]!.key;
    const st = vis.find((s) => s.key === keyEfetivo);
    onPainelTituloChange(st?.label ?? null);
  }, [subTabAtiva, permissoes, onPainelTituloChange]);

  if (subTabsVisiveis.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        Você não tem permissão para visualizar nenhuma tela do sistema.
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
        {subTabAtual === 'usuarios' && (
          <UsuariosSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onCurrentUserUpdate={onCurrentUserUpdate}
            permissoes={permissoes}
          />
        )}
        {subTabAtual === 'gestao-sistema' && (
          <GestaoSistemaSection
            currentUser={currentUser}
            permissoes={permissoes}
          />
        )}
        {subTabAtual === 'relatorios' && (
          <RelatoriosSection
            currentUser={currentUser}
            permissoes={permissoes}
          />
        )}
      </Box>
    </Box>
  );
}
