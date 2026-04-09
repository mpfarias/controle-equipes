import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, removeToken } from './api.ts';
import type { PermissaoAcao, Usuario, UsuarioNivelPermissao } from './types.ts';
import {
  TABS,
  AFastamentosSubTABS,
  EfetivoSubTABS,
  SistemaSubTABS,
  type TabKey,
  type TabChangeOptions,
  type AfastamentosSubTabKey,
  type SistemaSubTabKey,
  type PreencherCadastroAfastamentoInput,
} from './constants';
import { ORIAN_NAVIGATE_TAB, type NavigateTabEventDetail } from './constants/appNavigation';
import { buildUrlComHandoffJwt } from './constants/orionEcossistemaAuth';
import { getUrlOrionJuridico } from './constants/orionJuridico';
import { getUrlOrionQualidade } from './constants/orionQualidade';
import { getUrlOrionPatrimonio } from './constants/orionPatrimonio';
import { getUrlOrionSuporte } from './constants/orionSuporte';
import {
  expandirPermissoesLegadoEscalas,
  propagarPermissoesEscalasSubtelasParaAbaPrincipal,
  temAcessoEscalas,
} from './utils/permissions';
import { temAcessoOrionSuporteEfetivo } from './utils/orionSuporteEfetivo';
import {
  BROWSER_TITLE_APP_SAD,
  formatDocumentTitleSAD,
  rotuloAbaPrincipalSAD,
} from './utils/browserTitleSAD';
import { formatMatricula } from './utils/dateUtils';
import {
  Avatar,
  Badge,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  FactCheck,
  Gavel,
  Logout,
  PhotoCamera,
  Lock,
  SupportAgent,
  Inventory2,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { ImageCropper } from './components/common/ImageCropper';
import {
  LoginView,
  ForgotPasswordView,
  SecurityQuestionView,
  SelecionarSistemaView,
} from './components/auth';
import {
  clearSistemaSessao,
  getSistemaDestino,
  listaDestinosPosLogin,
  resolverFluxoSistemas,
  SISTEMA_ID_APP_ATUAL,
  SISTEMA_ID_ORION_JURIDICO,
  SISTEMA_ID_ORION_PATRIMONIO,
  SISTEMA_ID_ORION_QUALIDADE,
  SISTEMA_ID_ORION_SUPORTE,
  writeSistemaSessao,
} from './constants/sistemaDestinos';
import { ConfirmDialog, type ConfirmConfig, type ConfirmDialogConfig } from './components/common';
import { StartupFeriasAvisos } from './components/alerts/StartupFeriasAvisos';

function navegarComHandoffJwt(urlBase: string) {
  const t = getToken();
  window.location.assign(t ? buildUrlComHandoffJwt(urlBase, t) : urlBase);
}

function abrirNovaAbaComHandoffJwt(urlBase: string) {
  const t = getToken();
  const url = t ? buildUrlComHandoffJwt(urlBase, t) : urlBase;
  window.open(url, '_blank', 'noopener,noreferrer');
}

const DashboardHomeSection = lazy(() => import('./components/sections/DashboardHomeSection').then((m) => ({ default: m.DashboardHomeSection })));
const CalendarioSection = lazy(() => import('./components/sections/CalendarioSection').then((m) => ({ default: m.CalendarioSection })));
const EscalasSection = lazy(() => import('./components/sections/EscalasSection').then((m) => ({ default: m.EscalasSection })));
const MostrarEquipeSection = lazy(() =>
  import('./components/sections/MostrarEquipeSection').then((m) => ({ default: m.MostrarEquipeSection })),
);
const AfastamentosGroupSection = lazy(() =>
  import('./components/sections/AfastamentosGroupSection').then((m) => ({ default: m.AfastamentosGroupSection })),
);
const SistemaGroupSection = lazy(() =>
  import('./components/sections/SistemaGroupSection').then((m) => ({ default: m.SistemaGroupSection })),
);
const ReportarErroSection = lazy(() =>
  import('./components/sections/ReportarErroSection').then((m) => ({ default: m.ReportarErroSection })),
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
  const confirmDialogActionRef = useRef<ConfirmDialogConfig['onConfirm']>(undefined);
  confirmDialogActionRef.current = confirmDialog.onConfirm;
  const [policiaisVersion, setPoliciaisVersion] = useState(0);
  const [afastamentosVersion, setAfastamentosVersion] = useState(0);
  const [permissoesPorTela, setPermissoesPorTela] = useState<Record<TabKey, Record<PermissaoAcao, boolean>> | null>(null);
  const [permissoesCarregando, setPermissoesCarregando] = useState(false);
  /** Preencher formulário de cadastro ao abrir "Gerenciar afastamentos" (ex.: policial + motivo Férias). Consumida ao montar AfastamentosSection. */
  const [afastamentosPreencherCadastro, setAfastamentosPreencherCadastro] =
    useState<PreencherCadastroAfastamentoInput | null>(null);
  /** Sub-tab inicial ao navegar para aba Afastamentos (ex.: a partir do Dashboard). */
  const [afastamentosInitialSubTab, setAfastamentosInitialSubTab] = useState<AfastamentosSubTabKey>('afastamentos');
  /** Sub-tab inicial ao navegar para aba Sistema. */
  const [sistemaInitialSubTab, setSistemaInitialSubTab] = useState<SistemaSubTabKey>('usuarios');
  const [avatarMenuAnchor, setAvatarMenuAnchor] = useState<HTMLElement | null>(null);
  const [fotoModalOpen, setFotoModalOpen] = useState(false);
  const [imageForCrop, setImageForCrop] = useState('');
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [fotoSubmitting, setFotoSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [senhaModalOpen, setSenhaModalOpen] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirmar, setSenhaConfirmar] = useState('');
  const [senhaError, setSenhaError] = useState<string | null>(null);
  const [senhaSuccess, setSenhaSuccess] = useState<string | null>(null);
  const [senhaSubmitting, setSenhaSubmitting] = useState(false);
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showSenhaNova, setShowSenhaNova] = useState(false);
  const [showSenhaConfirmar, setShowSenhaConfirmar] = useState(false);
  /** Após o usuário sair do campo de confirmação (ou da nova senha com confirmação já preenchida) */
  const [senhaConfirmarValidarAoSair, setSenhaConfirmarValidarAoSair] = useState(false);
  /** Vários sistemas permitidos: aguardando escolha antes do painel principal. */
  const [aguardandoEscolhaSistema, setAguardandoEscolhaSistema] = useState(false);
  /** Incrementado ao pedir foco no formulário de chamado (ex.: botão "Abrir chamado"). */
  const [focusChamadoFormSeq, setFocusChamadoFormSeq] = useState(0);
  const [tituloPainelDetalhe, setTituloPainelDetalhe] = useState<string | null>(null);

  const handlePainelTituloSAD = useCallback((label: string | null) => {
    setTituloPainelDetalhe(label);
  }, []);

  useEffect(() => {
    setTituloPainelDetalhe(null);
  }, [activeTab]);

  useEffect(() => {
    if (!currentUser) {
      document.title =
        authView === 'forgot-password'
          ? `${BROWSER_TITLE_APP_SAD} — Recuperar senha`
          : authView === 'security-question'
            ? `${BROWSER_TITLE_APP_SAD} — Redefinir senha`
            : `${BROWSER_TITLE_APP_SAD} — Entrar`;
      return;
    }
    if (aguardandoEscolhaSistema) {
      document.title = `${BROWSER_TITLE_APP_SAD} — Escolher sistema`;
      return;
    }
    const ctx = tituloPainelDetalhe ?? rotuloAbaPrincipalSAD(activeTab);
    const primeiroNome = currentUser.nome.split(' ').filter(Boolean)[0];
    document.title = formatDocumentTitleSAD(ctx, { primeiroNomeUsuario: primeiroNome });
  }, [currentUser, authView, aguardandoEscolhaSistema, activeTab, tituloPainelDetalhe]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Verificar se há token armazenado
        const token = getToken();
        if (token) {
          try {
            const usuario = await api.getAuthMe();
            setCurrentUser(usuario);
            const fluxo = resolverFluxoSistemas(usuario);
            if (fluxo.acao === 'escolher-sistema') {
              setAguardandoEscolhaSistema(true);
            } else {
              setAguardandoEscolhaSistema(false);
              if (fluxo.redirecionarOrionSuporteComHandoff) {
                navegarComHandoffJwt(getUrlOrionSuporte());
              } else if (fluxo.redirecionarOrionQualidadeComHandoff) {
                navegarComHandoffJwt(getUrlOrionQualidade());
              } else if (fluxo.redirecionarOrionHandoffUrl) {
                navegarComHandoffJwt(fluxo.redirecionarOrionHandoffUrl);
              } else if (fluxo.redirecionarExterno) {
                window.location.assign(fluxo.redirecionarExterno);
              }
            }
          } catch (restoreErr) {
            console.warn('Sessão inválida ou expirada:', restoreErr);
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
      for (const k of ['escalas-gerar', 'escalas-consultar', 'troca-servico'] as TabKey[]) {
        base[k] = {
          VISUALIZAR: false,
          EDITAR: false,
          DESATIVAR: false,
          EXCLUIR: false,
        };
      }
      // Permissões antigas no banco (antes de retirar da UI de níveis); não definem mais o atalho no header.
      base['orion-qualidade'] = {
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

      expandirPermissoesLegadoEscalas(base);
      propagarPermissoesEscalasSubtelasParaAbaPrincipal(base);

      const ehAdminSistema =
        currentUser?.isAdmin === true ||
        currentUser?.nivel?.nome?.toUpperCase() === 'ADMINISTRADOR';
      if (ehAdminSistema) {
        (Object.keys(base) as TabKey[]).forEach((key) => {
          if (base[key]) {
            base[key] = {
              VISUALIZAR: true,
              EDITAR: true,
              DESATIVAR: true,
              EXCLUIR: true,
            };
          }
        });
      }

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
      const detail = (event as CustomEvent<NavigateTabEventDetail>).detail;
      if (!detail?.tab) return;
      setActiveTab(detail.tab);
      if (detail.focusChamadoForm) {
        setFocusChamadoFormSeq((n) => n + 1);
      }
    };
    window.addEventListener(ORIAN_NAVIGATE_TAB, handler);
    return () => window.removeEventListener(ORIAN_NAVIGATE_TAB, handler);
  }, []);

  useEffect(() => {
    if (activeTab !== 'reportar-erro') {
      setFocusChamadoFormSeq(0);
    }
  }, [activeTab]);

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
    const fluxo = resolverFluxoSistemas(loginResponse.usuario, { aposLogin: true });
    if (fluxo.acao === 'escolher-sistema') {
      setAguardandoEscolhaSistema(true);
      return;
    }
    setAguardandoEscolhaSistema(false);
    setActiveTab('dashboard');
    if (fluxo.redirecionarOrionSuporteComHandoff) {
      navegarComHandoffJwt(getUrlOrionSuporte());
      return;
    }
    if (fluxo.redirecionarOrionQualidadeComHandoff) {
      navegarComHandoffJwt(getUrlOrionQualidade());
      return;
    }
    if (fluxo.redirecionarOrionHandoffUrl) {
      navegarComHandoffJwt(fluxo.redirecionarOrionHandoffUrl);
      return;
    }
    if (fluxo.redirecionarExterno) {
      window.location.assign(fluxo.redirecionarExterno);
    }
  };

  const handleEscolherSistema = useCallback((sistemaId: string) => {
    if (!currentUser || !listaDestinosPosLogin(currentUser).includes(sistemaId)) {
      return;
    }
    writeSistemaSessao(sistemaId);
    setAguardandoEscolhaSistema(false);
    setActiveTab('dashboard');
    if (sistemaId === SISTEMA_ID_ORION_SUPORTE) {
      navegarComHandoffJwt(getUrlOrionSuporte());
      return;
    }
    if (sistemaId === SISTEMA_ID_ORION_QUALIDADE) {
      navegarComHandoffJwt(getUrlOrionQualidade());
      return;
    }
    if (sistemaId === SISTEMA_ID_ORION_PATRIMONIO) {
      navegarComHandoffJwt(getUrlOrionPatrimonio());
      return;
    }
    if (sistemaId !== SISTEMA_ID_APP_ATUAL) {
      const d = getSistemaDestino(sistemaId);
      if (d.tipo === 'orion-handoff' && d.configurado) {
        navegarComHandoffJwt(d.url);
        return;
      }
      if (d.tipo === 'externo' && d.configurado) {
        window.location.assign(d.url);
      }
    }
  }, [currentUser]);

  const handleLogout = async () => {
    setAvatarMenuAnchor(null);
    clearSistemaSessao();
    setAguardandoEscolhaSistema(false);
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

  const openSenhaModal = () => {
    setAvatarMenuAnchor(null);
    setSenhaModalOpen(true);
    setSenhaAtual('');
    setSenhaNova('');
    setSenhaConfirmar('');
    setSenhaError(null);
    setSenhaSuccess(null);
    setShowSenhaAtual(false);
    setShowSenhaNova(false);
    setShowSenhaConfirmar(false);
    setSenhaConfirmarValidarAoSair(false);
  };

  const closeSenhaModal = () => {
    setSenhaModalOpen(false);
    setSenhaAtual('');
    setSenhaNova('');
    setSenhaConfirmar('');
    setSenhaError(null);
    setSenhaSuccess(null);
    setSenhaConfirmarValidarAoSair(false);
  };

  const confirmacaoSenhaNaoConfere =
    senhaConfirmarValidarAoSair &&
    senhaConfirmar.length > 0 &&
    senhaNova !== senhaConfirmar;

  const handleAlterarSenhaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaError(null);
    setSenhaSuccess(null);

    if (!senhaAtual.trim()) {
      setSenhaError('Informe a senha atual.');
      return;
    }
    if (!senhaNova) {
      setSenhaError('Informe a nova senha.');
      return;
    }
    if (senhaNova.length < 8) {
      setSenhaError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(senhaNova)) {
      setSenhaError('A nova senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número.');
      return;
    }
    if (confirmacaoSenhaNaoConfere || senhaNova !== senhaConfirmar) {
      setSenhaError('A confirmação não confere com a nova senha.');
      return;
    }

    try {
      setSenhaSubmitting(true);
      const result = await api.changePassword({
        senhaAtual: senhaAtual,
        novaSenha: senhaNova,
      });
      setSenhaSuccess(result.message);
      setSenhaAtual('');
      setSenhaNova('');
      setSenhaConfirmar('');
      setSenhaConfirmarValidarAoSair(false);
    } catch (err) {
      setSenhaError(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setSenhaSubmitting(false);
    }
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
      const action = confirmDialogActionRef.current;
      if (action) {
        await action();
      }
    } finally {
      closeConfirm();
    }
  }, [closeConfirm]);

  /** Administrador do sistema: vê todas as abas principais mesmo sem linha explícita em UsuarioNivelPermissao (ex.: Escalas nova). */
  const usuarioEhAdministrador = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.isAdmin === true) return true;
    const nome = currentUser.nivel?.nome?.toUpperCase?.() ?? '';
    return nome === 'ADMINISTRADOR';
  }, [currentUser]);

  /** Avisos de férias (programadas / atrasadas) ao abrir o app — mesmo escopo de quem vê dashboard ou afastamentos. */
  const podeVerStartupFerias = useMemo(() => {
    if (!permissoesPorTela) return false;
    if (usuarioEhAdministrador) return true;
    return Boolean(
      permissoesPorTela.dashboard?.VISUALIZAR ||
        permissoesPorTela['afastamentos-mes']?.VISUALIZAR ||
        permissoesPorTela.afastamentos?.VISUALIZAR,
    );
  }, [permissoesPorTela, usuarioEhAdministrador]);

  const usuarioPodeVerDashboard = useMemo(() => {
    if (!permissoesPorTela) return false;
    if (usuarioEhAdministrador) return true;
    return Boolean(permissoesPorTela.dashboard?.VISUALIZAR);
  }, [permissoesPorTela, usuarioEhAdministrador]);

  /** Alinhado à API: gestão de chamados no app Órion Suporte (respeita negação explícita no usuário). */
  const usuarioPodeAcessarOrionSuporte = useMemo(() => {
    if (!currentUser) return false;
    return temAcessoOrionSuporteEfetivo(currentUser);
  }, [currentUser]);

  /** Órion Qualidade: só cadastro (`ORION_QUALIDADE` em sistemas permitidos), não permissão por nível. */
  const usuarioPodeOrionQualidade = useMemo(() => {
    if (!currentUser) return false;
    return listaDestinosPosLogin(currentUser).includes(SISTEMA_ID_ORION_QUALIDADE);
  }, [currentUser]);

  const usuarioPodeOrionJuridico = useMemo(() => {
    if (!currentUser) return false;
    return listaDestinosPosLogin(currentUser).includes(SISTEMA_ID_ORION_JURIDICO);
  }, [currentUser]);

  const usuarioPodeOrionPatrimonio = useMemo(() => {
    if (!currentUser) return false;
    return listaDestinosPosLogin(currentUser).includes(SISTEMA_ID_ORION_PATRIMONIO);
  }, [currentUser]);

  const [chamadosAbertosGestao, setChamadosAbertosGestao] = useState<number | null>(null);

  const carregarContagemChamadosGestao = useCallback(async () => {
    if (!usuarioPodeAcessarOrionSuporte) return;
    try {
      const { total } = await api.getErrorReportsAdminContagemAbertos();
      setChamadosAbertosGestao(total);
    } catch {
      setChamadosAbertosGestao(null);
    }
  }, [usuarioPodeAcessarOrionSuporte]);

  useEffect(() => {
    if (!currentUser || !usuarioPodeAcessarOrionSuporte) {
      setChamadosAbertosGestao(null);
      return;
    }
    void carregarContagemChamadosGestao();
    const intervalId = window.setInterval(() => {
      void carregarContagemChamadosGestao();
    }, 60_000);
    const onFocus = () => {
      void carregarContagemChamadosGestao();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void carregarContagemChamadosGestao();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [currentUser, usuarioPodeAcessarOrionSuporte, carregarContagemChamadosGestao]);

  // Filtrar tabs baseado nas permissões do banco
  const tabsDisponiveis = useMemo(() => {
    if (!permissoesPorTela) return [];
    if (usuarioEhAdministrador) {
      return TABS;
    }
    const temAcessoAfastamentos =
      permissoesPorTela['afastamentos-mes']?.VISUALIZAR ||
      permissoesPorTela['afastamentos']?.VISUALIZAR ||
      permissoesPorTela['restricao-afastamento']?.VISUALIZAR;
    const temAcessoEfetivo =
      permissoesPorTela['equipe']?.VISUALIZAR ||
      permissoesPorTela['policiais']?.VISUALIZAR ||
      permissoesPorTela['troca-servico']?.VISUALIZAR;
    const temAcessoSistema =
      permissoesPorTela['usuarios']?.VISUALIZAR ||
      permissoesPorTela['gestao-sistema']?.VISUALIZAR ||
      permissoesPorTela['relatorios']?.VISUALIZAR;
    return TABS.filter((tab) => {
      if (tab.key === 'reportar-erro') return true;
      if (tab.key === 'afastamentos') return Boolean(temAcessoAfastamentos);
      if (tab.key === 'equipe') return Boolean(temAcessoEfetivo);
      if (tab.key === 'sistema') return Boolean(temAcessoSistema);
      if (tab.key === 'escalas') return temAcessoEscalas(permissoesPorTela);
      return Boolean(permissoesPorTela[tab.key]?.VISUALIZAR);
    });
  }, [permissoesPorTela, usuarioEhAdministrador]);

  /**
   * Evita loop de `location.replace` ao Órion Suporte quando o perfil só tem gestão de chamados
   * (cadastro com SAD mínimo, mas sem permissão de telas do SAD além de “Reportar erro”).
   */
  const redirecionouPerfilSomenteSuporteRef = useRef(false);

  useEffect(() => {
    if (!currentUser) {
      redirecionouPerfilSomenteSuporteRef.current = false;
    }
  }, [currentUser]);

  useEffect(() => {
    if (
      !currentUser ||
      !permissoesPorTela ||
      permissoesCarregando ||
      aguardandoEscolhaSistema ||
      usuarioEhAdministrador
    ) {
      return;
    }
    if (!usuarioPodeAcessarOrionSuporte) return;
    if (redirecionouPerfilSomenteSuporteRef.current) return;

    const temTelaSADAlemReportar = tabsDisponiveis.some((t) => t.key !== 'reportar-erro');
    if (temTelaSADAlemReportar) return;

    redirecionouPerfilSomenteSuporteRef.current = true;
    const t = getToken();
    window.location.replace(t ? buildUrlComHandoffJwt(getUrlOrionSuporte(), t) : getUrlOrionSuporte());
  }, [
    currentUser,
    permissoesPorTela,
    permissoesCarregando,
    aguardandoEscolhaSistema,
    usuarioEhAdministrador,
    usuarioPodeAcessarOrionSuporte,
    tabsDisponiveis,
  ]);

  // Se o usuário não tem acesso à aba e está tentando acessá-la, redirecionar
  useEffect(() => {
    if (!currentUser || !permissoesPorTela) return;
    if (usuarioEhAdministrador) return;
    const temAcessoAfastamentos =
      permissoesPorTela['afastamentos-mes']?.VISUALIZAR ||
      permissoesPorTela['afastamentos']?.VISUALIZAR ||
      permissoesPorTela['restricao-afastamento']?.VISUALIZAR;
    const temAcessoEfetivo =
      permissoesPorTela['equipe']?.VISUALIZAR ||
      permissoesPorTela['policiais']?.VISUALIZAR ||
      permissoesPorTela['troca-servico']?.VISUALIZAR;
    const temAcessoSistema =
      permissoesPorTela['usuarios']?.VISUALIZAR ||
      permissoesPorTela['gestao-sistema']?.VISUALIZAR ||
      permissoesPorTela['relatorios']?.VISUALIZAR;
    const podeAcessar =
      activeTab === 'reportar-erro'
        ? true
        : activeTab === 'afastamentos'
          ? temAcessoAfastamentos
          : activeTab === 'equipe'
            ? temAcessoEfetivo
            : activeTab === 'sistema'
              ? temAcessoSistema
              : activeTab === 'escalas'
                ? temAcessoEscalas(permissoesPorTela)
                : Boolean(permissoesPorTela[activeTab]?.VISUALIZAR);
    if (!podeAcessar) {
      const destino =
        (() => {
          const temAfast =
            permissoesPorTela['afastamentos-mes']?.VISUALIZAR ||
            permissoesPorTela['afastamentos']?.VISUALIZAR ||
            permissoesPorTela['restricao-afastamento']?.VISUALIZAR;
          const temEfet =
            permissoesPorTela['equipe']?.VISUALIZAR ||
            permissoesPorTela['policiais']?.VISUALIZAR ||
            permissoesPorTela['troca-servico']?.VISUALIZAR;
          const temSis =
            permissoesPorTela['usuarios']?.VISUALIZAR ||
            permissoesPorTela['gestao-sistema']?.VISUALIZAR ||
            permissoesPorTela['relatorios']?.VISUALIZAR;
          const ordem: TabKey[] = [
            'dashboard',
            'calendario',
            'escalas',
            'afastamentos',
            'equipe',
            'sistema',
            'reportar-erro',
          ];
          for (const k of ordem) {
            if (k === 'reportar-erro') continue;
            if (k === 'dashboard' && permissoesPorTela['dashboard']?.VISUALIZAR) return k;
            if (k === 'calendario' && permissoesPorTela['calendario']?.VISUALIZAR) return k;
            if (k === 'escalas' && temAcessoEscalas(permissoesPorTela)) return k;
            if (k === 'afastamentos' && temAfast) return k;
            if (k === 'equipe' && temEfet) return k;
            if (k === 'sistema' && temSis) return k;
          }
          return 'reportar-erro' as TabKey;
        })();
      setActiveTab(destino);
    }
  }, [currentUser, activeTab, permissoesPorTela, usuarioEhAdministrador]);

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
      <div className="app-container app-container--auth">
        <div className="auth-shell">
          <header className="auth-header">
            <h1 className="auth-header__title">Órion - Sistema Integrado de Gestão e Análise - COPOM</h1>
            <p className="auth-header__subtitle">
              {authView === 'login' && 'Acesse com matrícula e senha institucionais.'}
              {authView === 'forgot-password' && 'Recupere sua senha informando sua matrícula.'}
              {authView === 'security-question' && 'Redefina sua senha respondendo à pergunta de segurança.'}
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
        </div>
        <footer className="app-footer app-footer--auth">
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

  if (currentUser && aguardandoEscolhaSistema) {
    return (
      <div className="app-container app-container--auth">
        <div className="auth-shell">
          <header className="auth-header">
            <h1 className="auth-header__title">Órion - Sistema Integrado de Gestão e Análise - COPOM</h1>
            <p className="auth-header__subtitle">Selecione qual sistema deseja acessar nesta sessão.</p>
          </header>
          <SelecionarSistemaView
            usuario={currentUser}
            onEscolher={handleEscolherSistema}
            onLogout={handleLogout}
          />
        </div>
        <footer className="app-footer app-footer--auth">
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
          Sistema Órion SAD
          </h1>
          <p>Gerencie usuários, policiais e afastamentos da equipe.</p>
        </div>
        <div className="header-actions">
          <span>
            {currentUser.nome} — {formatMatricula(currentUser.matricula)}
          </span>
          {usuarioPodeAcessarOrionSuporte ? (
            <Tooltip
              title={
                (chamadosAbertosGestao ?? 0) > 0
                  ? `${chamadosAbertosGestao} chamado(s) aguardando análise (abertos ou em análise). Clique para abrir o Órion Suporte.`
                  : 'Órion Suporte — gestão de chamados. Nenhum chamado pendente no momento.'
              }
            >
              <IconButton
                size="small"
                onClick={() => abrirNovaAbaComHandoffJwt(getUrlOrionSuporte())}
                aria-label={
                  (chamadosAbertosGestao ?? 0) > 0
                    ? `Órion Suporte: ${chamadosAbertosGestao} chamado(s) em aberto ou em análise`
                    : 'Abrir Órion Suporte'
                }
                sx={{ color: 'var(--text-primary)' }}
              >
                <Badge
                  color="error"
                  badgeContent={chamadosAbertosGestao && chamadosAbertosGestao > 0 ? chamadosAbertosGestao : 0}
                  invisible={!chamadosAbertosGestao || chamadosAbertosGestao < 1}
                  max={99}
                  overlap="circular"
                >
                  <SupportAgent sx={{ fontSize: 24 }} />
                </Badge>
              </IconButton>
            </Tooltip>
          ) : null}
          {usuarioPodeOrionQualidade ? (
            <Tooltip title="Órion Qualidade — abrir em nova aba">
              <IconButton
                size="small"
                onClick={() => abrirNovaAbaComHandoffJwt(getUrlOrionQualidade())}
                aria-label="Abrir Órion Qualidade"
                sx={{ color: 'var(--text-primary)' }}
              >
                <FactCheck sx={{ fontSize: 24 }} />
              </IconButton>
            </Tooltip>
          ) : null}
          {usuarioPodeOrionPatrimonio ? (
            <Tooltip title="Órion Patrimônio — abrir em nova aba">
              <IconButton
                size="small"
                onClick={() => abrirNovaAbaComHandoffJwt(getUrlOrionPatrimonio())}
                aria-label="Abrir Órion Patrimônio"
                sx={{ color: 'var(--text-primary)' }}
              >
                <Inventory2 sx={{ fontSize: 24 }} />
              </IconButton>
            </Tooltip>
          ) : null}
          {usuarioPodeOrionJuridico ? (
            <Tooltip title="Órion Jurídico — abrir em nova aba">
              <IconButton
                size="small"
                onClick={() => abrirNovaAbaComHandoffJwt(getUrlOrionJuridico())}
                aria-label="Abrir Órion Jurídico"
                sx={{ color: 'var(--text-primary)' }}
              >
                <Gavel sx={{ fontSize: 24 }} />
              </IconButton>
            </Tooltip>
          ) : null}
          <Tooltip title="Menu do usuário">
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
          </Tooltip>
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
            <MenuItem onClick={openSenhaModal}>
              <Lock sx={{ mr: 1.5, fontSize: 20 }} />
              Alterar senha
            </MenuItem>
            {usuarioPodeOrionQualidade ? (
              <MenuItem
                onClick={() => {
                  setAvatarMenuAnchor(null);
                  abrirNovaAbaComHandoffJwt(getUrlOrionQualidade());
                }}
              >
                <FactCheck sx={{ mr: 1.5, fontSize: 20 }} />
                Órion Qualidade
              </MenuItem>
            ) : null}
            {usuarioPodeOrionPatrimonio ? (
              <MenuItem
                onClick={() => {
                  setAvatarMenuAnchor(null);
                  abrirNovaAbaComHandoffJwt(getUrlOrionPatrimonio());
                }}
              >
                <Inventory2 sx={{ mr: 1.5, fontSize: 20 }} />
                Órion Patrimônio
              </MenuItem>
            ) : null}
            {usuarioPodeOrionJuridico ? (
              <MenuItem
                onClick={() => {
                  setAvatarMenuAnchor(null);
                  abrirNovaAbaComHandoffJwt(getUrlOrionJuridico());
                }}
              >
                <Gavel sx={{ mr: 1.5, fontSize: 20 }} />
                Órion Jurídico
              </MenuItem>
            ) : null}
            {usuarioPodeAcessarOrionSuporte ? (
              <MenuItem
                onClick={() => {
                  setAvatarMenuAnchor(null);
                  abrirNovaAbaComHandoffJwt(getUrlOrionSuporte());
                }}
              >
                <SupportAgent sx={{ mr: 1.5, fontSize: 20 }} />
                Órion Suporte
              </MenuItem>
            ) : null}
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

      {senhaModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="alterar-senha-titulo"
          onClick={closeSenhaModal}
        >
          <div
            className="modal"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="alterar-senha-titulo">Alterar senha</h3>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Use uma senha forte (mínimo 8 caracteres, com letra minúscula, maiúscula e número).
            </p>
            {senhaError && (
              <div className="feedback error" style={{ marginBottom: 12 }}>
                {senhaError}
                <button
                  type="button"
                  className="feedback-close"
                  onClick={() => setSenhaError(null)}
                  aria-label="Fechar aviso"
                >
                  ×
                </button>
              </div>
            )}
            {senhaSuccess && (
              <div className="feedback success" style={{ marginBottom: 12 }}>
                {senhaSuccess}
                <button
                  type="button"
                  className="feedback-close"
                  onClick={() => setSenhaSuccess(null)}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            )}
            <Box component="form" onSubmit={handleAlterarSenhaSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Senha atual"
                type={showSenhaAtual ? 'text' : 'password'}
                value={senhaAtual}
                onChange={(ev) => setSenhaAtual(ev.target.value)}
                fullWidth
                required
                variant="outlined"
                size="small"
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showSenhaAtual ? 'Ocultar senha' : 'Mostrar senha'}
                        onClick={() => setShowSenhaAtual((v) => !v)}
                        edge="end"
                        size="small"
                      >
                        {showSenhaAtual ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Nova senha"
                type={showSenhaNova ? 'text' : 'password'}
                value={senhaNova}
                onChange={(ev) => setSenhaNova(ev.target.value)}
                onBlur={() => {
                  if (senhaConfirmar.length > 0) {
                    setSenhaConfirmarValidarAoSair(true);
                  }
                }}
                fullWidth
                required
                variant="outlined"
                size="small"
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showSenhaNova ? 'Ocultar senha' : 'Mostrar senha'}
                        onClick={() => setShowSenhaNova((v) => !v)}
                        edge="end"
                        size="small"
                      >
                        {showSenhaNova ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Confirmar nova senha"
                type={showSenhaConfirmar ? 'text' : 'password'}
                value={senhaConfirmar}
                onChange={(ev) => setSenhaConfirmar(ev.target.value)}
                onBlur={() => setSenhaConfirmarValidarAoSair(true)}
                error={confirmacaoSenhaNaoConfere}
                helperText={confirmacaoSenhaNaoConfere ? 'As senhas não conferem.' : undefined}
                fullWidth
                required
                variant="outlined"
                size="small"
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showSenhaConfirmar ? 'Ocultar senha' : 'Mostrar senha'}
                        onClick={() => setShowSenhaConfirmar((v) => !v)}
                        edge="end"
                        size="small"
                      >
                        {showSenhaConfirmar ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <div className="modal-actions" style={{ marginTop: 8 }}>
                <button type="button" className="secondary" onClick={closeSenhaModal} disabled={senhaSubmitting}>
                  {senhaSuccess ? 'Fechar' : 'Cancelar'}
                </button>
                {!senhaSuccess && (
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={senhaSubmitting || confirmacaoSenhaNaoConfere}
                    sx={{ minWidth: 160 }}
                  >
                    {senhaSubmitting ? 'Salvando…' : 'Salvar nova senha'}
                  </Button>
                )}
              </div>
            </Box>
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
              if (tab.key === 'afastamentos') setAfastamentosInitialSubTab('afastamentos');
              if (tab.key === 'sistema') setSistemaInitialSubTab('usuarios');
            }}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <StartupFeriasAvisos
        key={currentUser.id}
        currentUser={currentUser}
        enabled={!permissoesCarregando && Boolean(permissoesPorTela) && podeVerStartupFerias}
        podeAbrirDashboard={usuarioPodeVerDashboard}
        onIrPara={(tab) => {
          setActiveTab(tab);
          if (tab === 'afastamentos') setAfastamentosInitialSubTab('afastamentos');
        }}
        refreshKeyPoliciais={policiaisVersion}
        refreshKeyAfastamentos={afastamentosVersion}
      />

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
        {activeTab === 'escalas' && (
          <EscalasSection
            currentUser={currentUser}
            permissoes={permissoesPorTela}
            onPainelTituloChange={handlePainelTituloSAD}
          />
        )}
        {activeTab === 'afastamentos' && (
          <AfastamentosGroupSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onChanged={notifyAfastamentosChanged}
            permissoes={permissoesPorTela}
            initialSubTab={afastamentosInitialSubTab}
            initialCadastro={afastamentosPreencherCadastro}
            onPreencherCadastroConsumed={() => setAfastamentosPreencherCadastro(null)}
            onPainelTituloChange={handlePainelTituloSAD}
          />
        )}
        {activeTab === 'equipe' && (
          <MostrarEquipeSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onChanged={notifyPoliciaisChanged}
            refreshKey={policiaisVersion}
            permissoes={permissoesPorTela}
            onPainelTituloChange={handlePainelTituloSAD}
          />
        )}
        {activeTab === 'sistema' && (
          <SistemaGroupSection
            currentUser={currentUser}
            openConfirm={openConfirm}
            onCurrentUserUpdate={(updatedUser) => setCurrentUser(updatedUser)}
            permissoes={permissoesPorTela}
            initialSubTab={sistemaInitialSubTab}
            onPainelTituloChange={handlePainelTituloSAD}
          />
        )}
        {activeTab === 'reportar-erro' && (
          <ReportarErroSection currentUser={currentUser} focusChamadoFormSeq={focusChamadoFormSeq} />
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
