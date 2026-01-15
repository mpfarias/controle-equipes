import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getToken, removeToken } from './api.ts';
import type { Usuario } from './types.ts';
import { TABS, type TabKey } from './constants';
import {
  LoginView,
  ForgotPasswordView,
  ResetPasswordView,
  SecurityQuestionView,
} from './components/auth';
import { ConfirmDialog, type ConfirmConfig, type ConfirmDialogConfig } from './components/common';
import { DashboardSection } from './components/sections/DashboardSection';
import { MostrarEquipeSection } from './components/sections/MostrarEquipeSection';
import { PoliciaisSection } from './components/sections/PoliciaisSection';
import { AfastamentosSection } from './components/sections/AfastamentosSection';
import { UsuariosSection } from './components/sections/UsuariosSection';
import { RelatoriosSection } from './components/sections/RelatoriosSection';

type AuthView = 'login' | 'forgot-password' | 'reset-password' | 'security-question';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard'); // Sempre inicia no dashboard (Afastamentos do mês)
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [securityQuestionData, setSecurityQuestionData] = useState<{
    matricula: string;
    pergunta: string;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig>({
    open: false,
    title: '',
    message: '',
  });
  const [policiaisVersion, setPoliciaisVersion] = useState(0);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Verificar se há token armazenado
        const token = getToken();
        if (token) {
          // Decodificar o JWT para obter o ID do usuário
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const userId = payload.sub;
            if (userId) {
              // Buscar dados do usuário do backend
              // O token será enviado automaticamente pelo api.ts no header Authorization
              const usuario = await api.getUsuario(userId);
              setCurrentUser(usuario);
            }
          } catch (decodeError) {
            // Token inválido, remover
            console.warn('Token inválido:', decodeError);
            removeToken();
          }
        }
      } catch (error) {
        console.warn('Não foi possível restaurar o usuário da sessão.', error);
        removeToken();
      }
    };

    void loadUser();

    // Verificar se há token na URL (reset de senha)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setResetToken(token);
      setAuthView('reset-password');
      // Limpar a URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleLoginSuccess = (loginResponse: { accessToken: string; usuario: Usuario }) => {
    setCurrentUser(loginResponse.usuario);
    setActiveTab('dashboard'); // Sempre volta para a tela "Afastamentos do mês" após login
    // O token já foi armazenado pelo api.login()
  };

  const handleLogout = () => {
    setCurrentUser(null);
    removeToken();
  };

  const openConfirm = useCallback((config: ConfirmConfig) => {
    setConfirmDialog({
      open: true,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      ...config,
    });
  }, []);
 
  const notifyPoliciaisChanged = useCallback(() => {
    setPoliciaisVersion((value) => value + 1);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({
      ...prev,
      open: false,
    }));
  }, []);

  const handleConfirmDialog = useCallback(async () => {
    try {
      if (confirmDialog.onConfirm) {
        await confirmDialog.onConfirm();
      }
    } finally {
      closeConfirm();
    }
  }, [confirmDialog, closeConfirm]);

  // Verificar se o usuário tem acesso à tela de usuários (apenas SAD e ADMINISTRADOR)
  const usuarioTemAcessoUsuarios = useMemo(() => {
    if (!currentUser) return false;
    
    // Verificar pelo nome do nível (prioritário)
    const nivelNome = currentUser.nivel?.nome;
    if (nivelNome === 'SAD' || nivelNome === 'ADMINISTRADOR') {
      return true;
    }
    
    // Verificar pelo isAdmin
    if (currentUser.isAdmin === true) {
      return true;
    }
    
    return false;
  }, [currentUser]);

  // Filtrar tabs baseado no nível do usuário
  const tabsDisponiveis = useMemo(() => {
    const nivelUsuario = currentUser?.nivel?.nome;
    
    // Filtrar tabs baseado no nível do usuário
    return TABS.filter((tab) => {
      // Relatórios só disponível para COMANDO e ADMINISTRADOR
      if (tab.key === 'relatorios') {
        return nivelUsuario === 'COMANDO' || nivelUsuario === 'ADMINISTRADOR';
      }
      // Cadastrar Policial só disponível para ADMINISTRADOR e SAD
      if (tab.key === 'policiais') {
        return nivelUsuario === 'ADMINISTRADOR' || nivelUsuario === 'SAD';
      }
      // Gerenciar afastamentos NÃO disponível para COMANDO e OPERAÇÕES
      if (tab.key === 'afastamentos') {
        return nivelUsuario !== 'COMANDO' && nivelUsuario !== 'OPERAÇÕES';
      }
      // A aba de usuários só está disponível para SAD e ADMINISTRADOR
      if (tab.key === 'usuarios') {
        return usuarioTemAcessoUsuarios;
      }
      // Todas as outras abas estão disponíveis para todos
      return true;
    });
  }, [currentUser, usuarioTemAcessoUsuarios]);

  // Se o usuário não tem acesso à aba e está tentando acessá-la, redirecionar
  useEffect(() => {
    if (!currentUser) return;
    
    const nivelUsuario = currentUser.nivel?.nome;
    const temAcessoRelatorios = nivelUsuario === 'COMANDO' || nivelUsuario === 'ADMINISTRADOR';
    const temAcessoPoliciais = nivelUsuario === 'ADMINISTRADOR' || nivelUsuario === 'SAD';
    const temAcessoAfastamentos = nivelUsuario !== 'COMANDO' && nivelUsuario !== 'OPERAÇÕES';
    
    if (activeTab === 'usuarios' && !usuarioTemAcessoUsuarios) {
      setActiveTab('dashboard');
    }
    if (activeTab === 'relatorios' && !temAcessoRelatorios) {
      setActiveTab('dashboard');
    }
    if (activeTab === 'policiais' && !temAcessoPoliciais) {
      setActiveTab('dashboard');
    }
    if (activeTab === 'afastamentos' && !temAcessoAfastamentos) {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab, usuarioTemAcessoUsuarios]);

  if (!currentUser) {
    const handleForgotPassword = () => {
      setAuthView('forgot-password');
    };

    const handleBackToLogin = () => {
      setAuthView('login');
      setResetToken(null);
      setSecurityQuestionData(null);
    };

    const handleSecurityQuestionReceived = (matricula: string, pergunta: string) => {
      setSecurityQuestionData({ matricula, pergunta });
      setAuthView('security-question');
    };

    const handleResetSuccess = () => {
      setAuthView('login');
      setResetToken(null);
    };

    return (
      <div className="app-container">
        <header>
          <h1>Sistema de Gestão de Unidade - COPOM</h1>
          <p>
            {authView === 'login' && 'Informe sua matrícula e senha para acessar o painel.'}
            {authView === 'forgot-password' && 'Recupere sua senha informando sua matrícula.'}
            {authView === 'reset-password' && 'Defina uma nova senha para sua conta.'}
          </p>
        </header>
        {authView === 'login' && (
          <LoginView onSuccess={handleLoginSuccess} onForgotPassword={handleForgotPassword} />
        )}
        {authView === 'forgot-password' && (
          <ForgotPasswordView
            onBack={handleBackToLogin}
            onSecurityQuestionReceived={handleSecurityQuestionReceived}
          />
        )}
        {authView === 'security-question' && securityQuestionData && (
          <SecurityQuestionView
            matricula={securityQuestionData.matricula}
            pergunta={securityQuestionData.pergunta}
            onBack={handleBackToLogin}
            onSuccess={handleResetSuccess}
          />
        )}
        {authView === 'reset-password' && (
          <ResetPasswordView
            token={resetToken || undefined}
            onBack={handleBackToLogin}
            onSuccess={handleResetSuccess}
          />
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <div>
          <h1>
          Sistema de Gestão de Pessoal - COPOM
          </h1>
          <p>Gerencie usuários, policiais e afastamentos da equipe.</p>
        </div>
        <div className="header-actions">
          <span>
            {currentUser.nome} — {currentUser.matricula}
          </span>
          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </header>

      <ul className="tabs" role="tablist">
        {tabsDisponiveis.map((tab) => (
          <li key={tab.key} role="presentation">
            <button
              role="tab"
              aria-selected={activeTab === tab.key}
              type="button"
              className={activeTab === tab.key ? 'tab active' : 'tab'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === 'dashboard' && <DashboardSection currentUser={currentUser} />}
      {activeTab === 'afastamentos' && (
        <AfastamentosSection
          currentUser={currentUser}
          openConfirm={openConfirm}
        />
      )}
      {activeTab === 'policiais' && (
         <PoliciaisSection
           currentUser={currentUser}
           onChanged={notifyPoliciaisChanged}
         />
       )}
       {activeTab === 'equipe' && (
         <MostrarEquipeSection
           currentUser={currentUser}
           openConfirm={openConfirm}
           onChanged={notifyPoliciaisChanged}
           refreshKey={policiaisVersion}
         />
       )}
      {activeTab === 'usuarios' && (
        <UsuariosSection
          currentUser={currentUser}
          openConfirm={openConfirm}
          onCurrentUserUpdate={(updatedUser) => {
            setCurrentUser(updatedUser);
          }}
        />
      )}
      {activeTab === 'relatorios' && (
        <RelatoriosSection currentUser={currentUser} />
      )}

      <ConfirmDialog
        config={confirmDialog}
        onCancel={closeConfirm}
        onConfirm={handleConfirmDialog}
      />
    </div>
  );
}
