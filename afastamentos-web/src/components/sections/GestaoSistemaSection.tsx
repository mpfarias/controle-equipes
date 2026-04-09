import { useState } from 'react';
import type { Usuario } from '../../types';
import type { PermissoesPorTela } from '../../utils/permissions';
import { NiveisAcessoSection } from './NiveisAcessoSection';
import { CadastroUsuariosSection } from './CadastroUsuariosSection';

interface GestaoSistemaSectionProps {
  currentUser: Usuario;
  permissoes?: PermissoesPorTela | null;
}

export function GestaoSistemaSection({
  currentUser,
  permissoes,
}: GestaoSistemaSectionProps) {
  const podeVerNiveis = true;
  const [mostrarOpcoesNiveis, setMostrarOpcoesNiveis] = useState(false);
  const [mostrarCadastroUsuarios, setMostrarCadastroUsuarios] = useState(false);

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Gestão do Sistema</h2>
          <p className="subtitle">Centralize as ações administrativas.</p>
        </div>
        <div
          style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            textAlign: 'right',
          }}
        >
          Usuário: {currentUser.nome}
        </div>
      </div>

      {podeVerNiveis ? (
        <div className="management-grid">
          <div className="management-item">
            <button
              type="button"
              className="management-card"
              onClick={() => setMostrarOpcoesNiveis((value) => !value)}
              aria-expanded={mostrarOpcoesNiveis}
            >
              <span className="management-card-title">Níveis de acesso</span>
              <span className="management-card-description">
                Criar e ajustar os níveis de acesso do sistema.
              </span>
            </button>
            <div className={`management-panel ${mostrarOpcoesNiveis ? 'management-panel--open' : ''}`}>
              <div className="management-panel__content">
                <NiveisAcessoSection currentUser={currentUser} embedded permissoes={permissoes} />
              </div>
            </div>
          </div>
          <div className="management-item">
            <button
              type="button"
              className="management-card"
              onClick={() => setMostrarCadastroUsuarios((value) => !value)}
              aria-expanded={mostrarCadastroUsuarios}
            >
              <span className="management-card-title">Cadastro de usuários</span>
              <span className="management-card-description">
                Gerencie o cadastro e o acesso de usuários do sistema.
              </span>
            </button>
            <div className={`management-panel ${mostrarCadastroUsuarios ? 'management-panel--open' : ''}`}>
              <div className="management-panel__content">
                <CadastroUsuariosSection currentUser={currentUser} permissoes={permissoes} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="empty-state">
          Você não possui permissões para acessar módulos de gestão no momento.
        </p>
      )}

      
    </section>
  );
}
