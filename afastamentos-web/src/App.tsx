import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, removeToken } from './api.ts';
import type { PermissaoAcao, Usuario, UsuarioNivelPermissao } from './types.ts';
import { TABS, AFastamentosSubTABS, EfetivoSubTABS, SistemaSubTABS, type TabKey, type TabChangeOptions, type AfastamentosSubTabKey, type SistemaSubTabKey } from './constants';
import { formatMatricula } from './utils/dateUtils';
import { Avatar, IconButton, Menu, MenuItem } from '@mui/material';
import { Logout, PhotoCamera } from '@mui/icons-material';
import { ImageCropper } from './components/common/ImageCropper';
import {
  LoginView,
  ForgotPasswordView,
  SecurityQuestionView,
} from './components/auth';
import { ConfirmDialog, type ConfirmConfig, type ConfirmDialogConfig } from './components/common';
const DashboardHomeSection = lazy(() => import('./components/sections/DashboardHomeSection').then((m) => ({ default: m.DashboardHomeSection })));
const CalendarioSection = lazy(() => import('./components/sections/CalendarioSection').then((m) => ({ default: m.CalendarioSection })));
const MostrarEquipeSection = lazy(() =>
  import('./components/sections/MostrarEquipeSection').then((m) => ({ default: m.MostrarEquipeSection })),
);
const AfastamentosGroupSection = lazy(() =>
  import('./components/sections/AfastamentosGroupSection').then((m) => ({ default: m.AfastamentosGroupSection })),
);
const SistemaGroupSection = lazy(() =>
  import('./components/sections/SistemaGroupSection').then((m) => ({ default: m.SistemaGroupSection })),
);

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
  /** Preencher formulário de cadastro ao abrir "Gerenciar afastamentos" (ex.: policial + motivo Férias). Consumida ao montar AfastamentosSection. */
  const [afastamentosPreencherCadastro, setAfastamentosPreencherCadastro] = useState<{ policialId: number; motivoNome: string } | null>(null);
  /** Sub-tab inicial ao navegar para aba Afastamentos (ex.: a partir do Dashboard). */
  const [afastamentosInitialSubTab, setAfastamentosInitialSubTab] = useState<AfastamentosSubTabKey>('afastamentos-mes');
  /** Sub-tab inicial ao navegar para aba Sistema. */
  const [sistemaInitialSubTab, setSistemaInitialSubTab] = useState<SistemaSubTabKey>('usuarios');
  const [avatarMenuAnchor, setAvatarMenuAnchor] = useState<HTMLElement | null>(null);
  const [fotoModalOpen, setFotoModalOpen] = useState(false);
  const [imageForCrop, setImageForCrop] = useState('');
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [fotoSubmitting, setFotoSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    const nivelId = currentUser?.nivelId ?? currentUser?.nivel?.id;
    if (!nivelId) {
      console.warn('Usuário não tem nivelId definido:', { userId: currentUser?.id, nivelId: currentUser?.nivelId });
      setPermissoesPorTela(null);
      setPermissoesCarregando(false);
      return;
    }
    try {
      setPermissoesCarregando(true);
      const data = await api.listUsuarioNivelPermissoes(nivelId);
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
      // Sub-telas da aba Afastamentos (permissões granulares no backend)
      AFastamentosSubTABS.forEach((st) => {
        base[st.key] = {
          VISUALIZAR: false,
          EDITAR: false,
          DESATIVAR: false,
          EXCLUIR: false,
        };
      });
      // Sub-telas da aba Efetivo (permissões granulares no backend)
      EfetivoSubTABS.forEach((st) => {
        if (!base[st.key]) {
          base[st.key] = { VISUALIZAR: false, EDITAR: false, DESATIVAR: false, EXCLUIR: false };
        }
      });
      // Sub-telas da aba Sistema (permissões granulares no backend)
      SistemaSubTABS.forEach((st) => {
        if (!base[st.key]) {
          base[st.key] = { VISUALIZAR: false, EDITAR: false, DESATIVAR: false, EXCLUIR: false };
        }
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
        if (base[key]) {
          base[key][item.acao] = true;
        } else {
          console.warn('TelaKey não encontrada em base:', { telaKey: item.telaKey, telasDisponiveis: Object.keys(base) });
        }
      });
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
      const nivelId = currentUser?.nivelId ?? currentUser?.nivel?.id;
      if (!nivelId) return;
      if (!detail?.nivelId || detail.nivelId === nivelId) {
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
    setAvatarMenuAnchor(null);
    // Registrar logout no backend antes de limpar o estado
    await api.logout();
    setCurrentUser(null);
  };

  const getIniciaisUsuario = (nome: string): string => {
    const partes = nome.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  };

  const openFotoModal = () => {
    setAvatarMenuAnchor(null);
    setFotoModalOpen(true);
    setFotoError(null);
    setShowImageCropper(false);
    setImageForCrop('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeFotoModal = () => {
    setFotoModalOpen(false);
    setShowImageCropper(false);
    setImageForCrop('');
    setFotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelectUsuario = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFotoError('Por favor, selecione uma imagem válida.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFotoError('A imagem deve ter no máximo 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target?.result as string;
        setImageForCrop(imageSrc);
        setShowImageCropper(true);
        setFotoError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropCompleteUsuario = async (croppedImageUrl: string) => {
    if (!currentUser || fotoSubmitting) return;
    try {
      setFotoSubmitting(true);
      setFotoError(null);
      const updated = await api.updateUsuario(currentUser.id, { fotoUrl: croppedImageUrl });
      setCurrentUser(updated);
      closeFotoModal();
    } catch (err) {
      setFotoError(err instanceof Error ? err.message : 'Não foi possível salvar a foto.');
    } finally {
      setFotoSubmitting(false);
    }
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

  // Filtrar tabs baseado nas permissões do banco
  const tabsDisponiveis = useMemo(() => {
    if (!permissoesPorTela) return [];
    const temAcessoAfastamentos =
      permissoesPorTela['afastamentos-mes']?.VISUALIZAR ||
      permissoesPorTela['afastamentos']?.VISUALIZAR ||
      permissoesPorTela['restricao-afastamento']?.VISUALIZAR;
    const temAcessoEfetivo =
      permissoesPorTela['equipe']?.VISUALIZAR || permissoesPorTela['policiais']?.VISUALIZAR;
    const temAcessoSistema =
      permissoesPorTela['usuarios']?.VISUALIZAR ||
      permissoesPorTela['gestao-sistema']?.VISUALIZAR ||
      permissoesPorTela['relatorios']?.VISUALIZAR;
    return TABS.filter((tab) => {
      if (tab.key === 'afastamentos') return Boolean(temAcessoAfastamentos);
      if (tab.key === 'equipe') return Boolean(temAcessoEfetivo);
      if (tab.key === 'sistema') return Boolean(temAcessoSistema);
      return Boolean(permissoesPorTela[tab.key]?.VISUALIZAR);
    });
  }, [permissoesPorTela]);

  // Se o usuário não tem acesso à aba e está tentando acessá-la, redirecionar
  useEffect(() => {
    if (!currentUser || !permissoesPorTela) return;
    const temAcessoAfastamentos =
      permissoesPorTela['afastamentos-mes']?.VISUALIZAR ||
      permissoesPorTela['afastamentos']?.VISUALIZAR ||
      permissoesPorTela['restricao-afastamento']?.VISUALIZAR;
    const temAcessoEfetivo =
      permissoesPorTela['equipe']?.VISUALIZAR || permissoesPorTela['policiais']?.VISUALIZAR;
    const temAcessoSistema =
      permissoesPorTela['usuarios']?.VISUALIZAR ||
      permissoesPorTela['gestao-sistema']?.VISUALIZAR ||
      permissoesPorTela['relatorios']?.VISUALIZAR;
    const podeAcessar =
      activeTab === 'afastamentos'
        ? temAcessoAfastamentos
        : activeTab === 'equipe'
          ? temAcessoEfetivo
          : activeTab === 'sistema'
            ? temAcessoSistema
            : Boolean(permissoesPorTela[activeTab]?.VISUALIZAR);
    if (!podeAcessar) setActiveTab('dashboard');
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
          <span className="app-footer__label">Desenvolvido por</span>
          <div className="app-footer__credits">
            <span className="app-footer__name">2º SGT M. Farias</span>
            <span className="app-footer__separator">·</span>
            <span className="app-footer__name">2º SGT Gadelha</span>
          </div>
          <span className="app-footer__meta">COPOM · {new Date().getFullYear()}</span>
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
            {currentUser.nome} — {formatMatricula(currentUser.matricula)}
          </span>
          <IconButton
            onClick={(e) => setAvatarMenuAnchor(e.currentTarget)}
            aria-label="Menu do usuário"
            aria-controls={avatarMenuAnchor ? 'user-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={avatarMenuAnchor ? 'true' : undefined}
            sx={{ p: 0 }}
          >
            <Avatar
              src={currentUser.fotoUrl ?? undefined}
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'var(--sentinela-blue)',
                fontSize: '1rem',
              }}
            >
              {getIniciaisUsuario(currentUser.nome)}
            </Avatar>
          </IconButton>
          <Menu
            id="user-menu"
            anchorEl={avatarMenuAnchor}
            open={Boolean(avatarMenuAnchor)}
            onClose={() => setAvatarMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { mt: 1.5 } } }}
          >
            <MenuItem onClick={openFotoModal}>
              <PhotoCamera sx={{ mr: 1.5, fontSize: 20 }} />
              Carregar foto
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1.5, fontSize: 20 }} />
              Sair
            </MenuItem>
          </Menu>
        </div>
      </header>

      {fotoModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeFotoModal}>
          <div className="modal" style={{ maxWidth: showImageCropper ? '800px' : '420px' }} onClick={(e) => e.stopPropagation()}>
            <h3>Carregar foto</h3>
            {fotoError && (
              <div className="feedback error">
                {fotoError}
                <button
                  type="button"
                  className="feedback-close"
                  onClick={() => setFotoError(null)}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            )}
            {showImageCropper ? (
              <ImageCropper
                imageSrc={imageForCrop}
                onCropComplete={handleCropCompleteUsuario}
                onCancel={() => {
                  setShowImageCropper(false);
                  setImageForCrop('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
            ) : (
              <>
                <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
                  Selecione uma imagem do seu dispositivo (máx. 5MB).
                </p>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 48,
                    backgroundColor: 'var(--bg-main)',
                    border: '2px dashed var(--border-soft)',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  <PhotoCamera sx={{ fontSize: 48, color: 'var(--text-secondary)', mb: 1 }} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Clique para selecionar uma imagem
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelectUsuario}
                  style={{ display: 'none' }}
                />
                <div className="modal-actions" style={{ marginTop: 24 }}>
                  <button type="button" className="secondary" onClick={closeFotoModal}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
                onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === 'afastamentos') setAfastamentosInitialSubTab('afastamentos-mes');
              if (tab.key === 'sistema') setSistemaInitialSubTab('usuarios');
            }}
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
            onTabChange={(tab, options?: TabChangeOptions) => {
              setActiveTab(tab);
              if (tab === 'afastamentos') {
                if (options?.subTab) setAfastamentosInitialSubTab(options.subTab);
                if (options?.preencherCadastro) setAfastamentosPreencherCadastro(options.preencherCadastro);
              }
            }}
            refreshKeyPoliciais={policiaisVersion}
            refreshKeyAfastamentos={afastamentosVersion}
          />
        )}
        {activeTab === 'calendario' && <CalendarioSection currentUser={currentUser} />}
        {activeTab === 'afastamentos' && (
          <AfastamentosGroupSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onChanged={notifyAfastamentosChanged}
            permissoes={permissoesPorTela}
            initialSubTab={afastamentosInitialSubTab}
            initialCadastro={afastamentosPreencherCadastro}
            onPreencherCadastroConsumed={() => setAfastamentosPreencherCadastro(null)}
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
        {activeTab === 'sistema' && (
          <SistemaGroupSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onCurrentUserUpdate={(updatedUser) => setCurrentUser(updatedUser)}
            permissoes={permissoesPorTela}
            initialSubTab={sistemaInitialSubTab}
          />
        )}
      </Suspense>

      <ConfirmDialog
        config={confirmDialog}
        onCancel={closeConfirm}
        onConfirm={handleConfirmDialog}
      />
      <footer className="app-footer">
        <span className="app-footer__label">Desenvolvido por</span>
        <div className="app-footer__credits">
          <span className="app-footer__name">2º SGT M. Farias</span>
          <span className="app-footer__separator">·</span>
          <span className="app-footer__name">2º SGT Gadelha</span>
        </div>
        <span className="app-footer__meta">COPOM · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
