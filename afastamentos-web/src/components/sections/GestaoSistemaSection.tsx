import { useMemo } from 'react';
import type { Usuario } from '../../types';
import type { TabKey } from '../../constants';

interface GestaoSistemaSectionProps {
  currentUser: Usuario;
  onTabChange: (tab: TabKey) => void;
  availableTabs: { key: TabKey; label: string }[];
}

type GestaoItem = {
  tab: TabKey;
  title: string;
  description: string;
};

export function GestaoSistemaSection({
  currentUser,
  onTabChange,
  availableTabs,
}: GestaoSistemaSectionProps) {
  const availableKeys = useMemo(
    () => new Set(availableTabs.map((tab) => tab.key)),
    [availableTabs],
  );

  const itensGestao = useMemo<GestaoItem[]>(
    () => [
      {
        tab: 'usuarios',
        title: 'Usuários',
        description: 'Cadastrar, editar e gerenciar acessos do sistema.',
      },
      {
        tab: 'policiais',
        title: 'Policiais',
        description: 'Cadastrar, atualizar e gerenciar dados de policiais.',
      },
      {
        tab: 'afastamentos',
        title: 'Afastamentos',
        description: 'Gerenciar afastamentos e suas restrições.',
      },
      {
        tab: 'restricao-afastamento',
        title: 'Restrições de afastamento',
        description: 'Gerar restrições para afastamentos ativos.',
      },
      {
        tab: 'calendario',
        title: 'Calendário das Equipes',
        description: 'Visualizar escalas e composição das equipes.',
      },
      {
        tab: 'equipe',
        title: 'Efetivo do COPOM',
        description: 'Consultar o efetivo disponível por equipe.',
      },
      {
        tab: 'relatorios',
        title: 'Relatórios',
        description: 'Emitir relatórios e acompanhamentos do sistema.',
      },
    ],
    [],
  );

  const itensVisiveis = useMemo(
    () => itensGestao.filter((item) => availableKeys.has(item.tab)),
    [itensGestao, availableKeys],
  );

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Gestão do Sistema</h2>
          <p className="subtitle">
            Centralize as principais ações administrativas em um só lugar.
          </p>
        </div>
        <div style={{ fontSize: '0.9rem', color: '#475569' }}>
          Usuário: {currentUser.nome}
        </div>
      </div>

      {itensVisiveis.length === 0 ? (
        <p className="empty-state">
          Você não possui permissões para acessar módulos de gestão no momento.
        </p>
      ) : (
        <div className="management-grid">
          {itensVisiveis.map((item) => (
            <button
              key={item.tab}
              type="button"
              className="management-card"
              onClick={() => onTabChange(item.tab)}
            >
              <span className="management-card-title">{item.title}</span>
              <span className="management-card-description">{item.description}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
