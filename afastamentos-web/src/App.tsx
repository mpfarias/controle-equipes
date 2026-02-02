import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { api, getToken, removeToken } from './api.ts';
import type { PermissaoAcao, Usuario, UsuarioNivelPermissao } from './types.ts';
import { TABS, type TabKey } from './constants';
import {
  LoginView,
  ForgotPasswordView,
  SecurityQuestionView,
} from './components/auth';
import { ConfirmDialog, type ConfirmConfig, type ConfirmDialogConfig } from './components/common';
const DashboardHomeSection = lazy(() => import('./components/sections/DashboardHomeSection').then((m) => ({ default: m.DashboardHomeSection })));
const DashboardSection = lazy(() => import('./components/sections/DashboardSection').then((m) => ({ default: m.DashboardSection })));
const MostrarEquipeSection = lazy(() =>
  import('./components/sections/MostrarEquipeSection').then((m) => ({ default: m.MostrarEquipeSection })),
);
const PoliciaisSection = lazy(() => import('./components/sections/PoliciaisSection').then((m) => ({ default: m.PoliciaisSection })));
const AfastamentosSection = lazy(() =>
  import('./components/sections/AfastamentosSection').then((m) => ({ default: m.AfastamentosSection })),
);
const UsuariosSection = lazy(() => import('./components/sections/UsuariosSection').then((m) => ({ default: m.UsuariosSection })));
const GestaoSistemaSection = lazy(() => import('./components/sections/GestaoSistemaSection').then((m) => ({ default: m.GestaoSistemaSection })));
const RelatoriosSection = lazy(() =>
  import('./components/sections/RelatoriosSection').then((m) => ({ default: m.RelatoriosSection })),
);
const GerarRestricaoAfastamentoSection = lazy(() =>
  import('./components/sections/GerarRestricaoAfastamentoSection').then((m) => ({ default: m.GerarRestricaoAfastamentoSection })),
);
const CalendarioSection = lazy(() => import('./components/sections/CalendarioSection').then((m) => ({ default: m.CalendarioSection })));

type AuthView = 'login' | 'forgot-password' | 'security-question';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard'); // Sempre inicia no Dashboard
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [authView, setAuthView] = useState<AuthView>('login');
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
  const [afastamentosVersion, setAfastamentosVersion] = useState(0);
  const [permissoesPorTela, setPermissoesPorTela] = useState<Record<TabKey, Record<PermissaoAcao, boolean>> | null>(null);
  const [permissoesCarregando, setPermissoesCarregando] = useState(false);

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

  }, []);

  const loadPermissoes = useCallback(async () => {
    if (!currentUser?.nivelId) {
      console.warn('Usuário não tem nivelId definido:', { userId: currentUser?.id, nivelId: currentUser?.nivelId });
      setPermissoesPorTela(null);
      setPermissoesCarregando(false);
      return;
    }
    try {
      setPermissoesCarregando(true);
      const data = await api.listUsuarioNivelPermissoes(currentUser.nivelId);
      console.log('Permissões carregadas do backend:', { nivelId: currentUser.nivelId, data });
      const base: Record<TabKey, Record<PermissaoAcao, boolean>> = {} as Record<TabKey, Record<PermissaoAcao, boolean>>;
      // Inicializar todas as telas do TABS
      TABS.forEach((tab) => {
        base[tab.key] = {
          VISUALIZAR: false,
          EDITAR: false,
          DESATIVAR: false,
          EXCLUIR: false,
        };
      });
      // Também inicializar relatorios-sistema e relatorios-servico (não estão no TABS mas são usados para permissões)
      base['relatorios-sistema'] = {
        VISUALIZAR: false,
        EDITAR: false,
        DESATIVAR: false,
        EXCLUIR: false,
      };
      base['relatorios-servico'] = {
        VISUALIZAR: false,
        EDITAR: false,
        DESATIVAR: false,
        EXCLUIR: false,
      };
      
      data.forEach((item: UsuarioNivelPermissao) => {
        const key = item.telaKey as TabKey;
        console.log('Processando permissão:', { telaKey: item.telaKey, acao: item.acao, key, existeEmBase: Boolean(base[key]) });
        if (base[key]) {
          base[key][item.acao] = true;
        } else {
          console.warn('TelaKey não encontrada em base:', { telaKey: item.telaKey, telasDisponiveis: Object.keys(base) });
        }
      });
      console.log('Permissões finais mapeadas:', base);
      setPermissoesPorTela(base);
    } catch (error) {
      console.warn('Não foi possível carregar permissões.', error);
      setPermissoesPorTela(null);
    } finally {
      setPermissoesCarregando(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadPermissoes();
  }, [loadPermissoes]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ nivelId?: number }>).detail;
      if (!currentUser?.nivelId) {
        return;
      }
      if (!detail?.nivelId || detail.nivelId === currentUser.nivelId) {
        void loadPermissoes();
      }
    };
    window.addEventListener('nivel-permissoes-atualizadas', handler);
    return () => window.removeEventListener('nivel-permissoes-atualizadas', handler);
  }, [currentUser, loadPermissoes]);

  const handleLoginSuccess = (loginResponse: { accessToken: string; usuario: Usuario }) => {
    setCurrentUser(loginResponse.usuario);
    setActiveTab('dashboard'); // Sempre volta para a tela "Afastamentos do mês" após login
    // O token já foi armazenado pelo api.login()
  };

  const handleLogout = async () => {
    // Registrar logout no backend antes de limpar o estado
    await api.logout();
    setCurrentUser(null);
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

  const notifyAfastamentosChanged = useCallback(() => {
    setAfastamentosVersion((value) => value + 1);
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

  // Filtrar tabs baseado apenas nas permissões do banco
  const tabsDisponiveis = useMemo(() => {
    if (!permissoesPorTela) {
      return [];
    }
    return TABS.filter((tab) => Boolean(permissoesPorTela[tab.key]?.VISUALIZAR));
  }, [permissoesPorTela]);

  // Se o usuário não tem acesso à aba e está tentando acessá-la, redirecionar
  useEffect(() => {
    if (!currentUser) return;

    if (!permissoesPorTela) {
      return;
    }
    if (!permissoesPorTela[activeTab]?.VISUALIZAR) {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab, permissoesPorTela]);

  if (!currentUser) {
    const handleForgotPassword = () => {
      setAuthView('forgot-password');
    };

    const handleBackToLogin = () => {
      setAuthView('login');
      setSecurityQuestionData(null);
    };

    const handleSecurityQuestionReceived = (matricula: string, pergunta: string) => {
      setSecurityQuestionData({ matricula, pergunta });
      setAuthView('security-question');
    };

    const handleResetSuccess = () => {
      setAuthView('login');
    };

    return (
      <div className="app-container">
        <header className="auth-header">
          <h1>Sistema Sentinela de Gestão de Pessoal - COPOM</h1>
          <p>
            {authView === 'login'}
            {authView === 'forgot-password' && 'Recupere sua senha informando sua matrícula.'}
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
        <footer className="app-footer">
          <p>Desenvolvido por:</p>
          <p>2º SGT M. Farias - COPOM - {new Date().getFullYear()}</p>
          2º SGT Gadelha - COPOM - {new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  return (
    <div className={`app-container ${activeTab === 'dashboard' ? 'app-container-dashboard' : ''}`}>
      <header>
        <div>
          <h1>
          Sistema Sentinela de Gestão de Pessoal - COPOM
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

      {permissoesCarregando ? (
        <p className="empty-state">Carregando permissões...</p>
      ) : (
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
      )}

      <Suspense fallback={<p className="empty-state">Carregando...</p>}>
        {activeTab === 'dashboard' && (
          <DashboardHomeSection
            currentUser={currentUser}
            onTabChange={setActiveTab}
            refreshKeyPoliciais={policiaisVersion}
            refreshKeyAfastamentos={afastamentosVersion}
          />
        )}
        {activeTab === 'calendario' && <CalendarioSection currentUser={currentUser} />}
        {activeTab === 'afastamentos-mes' && <DashboardSection currentUser={currentUser} />}
        {activeTab === 'afastamentos' && (
          <AfastamentosSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onChanged={notifyAfastamentosChanged}
            permissoes={permissoesPorTela}
          />
        )}
        {activeTab === 'policiais' && (
          <PoliciaisSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onChanged={notifyPoliciaisChanged}
            permissoes={permissoesPorTela}
          />
        )}
        {activeTab === 'equipe' && (
          <MostrarEquipeSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onChanged={notifyPoliciaisChanged}
            refreshKey={policiaisVersion}
            permissoes={permissoesPorTela}
          />
        )}
        {activeTab === 'usuarios' && (
          <UsuariosSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onCurrentUserUpdate={(updatedUser) => {
              setCurrentUser(updatedUser);
            }}
            permissoes={permissoesPorTela}
          />
        )}
        {activeTab === 'gestao-sistema' && (
          <GestaoSistemaSection
            currentUser={currentUser}
            permissoes={permissoesPorTela}
          />
        )}
        {activeTab === 'relatorios' && (
          <RelatoriosSection currentUser={currentUser} permissoes={permissoesPorTela} />
        )}
        {activeTab === 'restricao-afastamento' && (
          <GerarRestricaoAfastamentoSection 
            openConfirm={openConfirm}
            permissoes={permissoesPorTela}
          />
        )}
      </Suspense>

      <ConfirmDialog
        config={confirmDialog}
        onCancel={closeConfirm}
        onConfirm={handleConfirmDialog}
      />
      <footer className="app-footer">
        Desenvolvido por:<p>2º SGT M. Farias - COPOM - {new Date().getFullYear()}</p>
        <p> 2º SGT Gadelha - COPOM - {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
