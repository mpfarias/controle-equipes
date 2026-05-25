import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  CalendarMonthOutlined,
  Description,
  FactCheck,
  Gavel,
  Hub,
  Inventory2,
  Logout,
  SupportAgent,
  Woman,
} from '@mui/icons-material';
import { LoginAgendaView } from './auth/LoginAgendaView';
import { AgendaInicioSection } from './components/AgendaInicioSection';
import { api, getToken } from './api';
import {
  buildUrlComHandoffJwt,
  removerAcessoIdSession,
  removerTokenSession,
} from './constants/orionEcossistemaAuth';
import type { OrionAgendaSessao, Usuario } from './types';
import { formatMatricula } from './utils/formatMatricula';
import {
  formatUsuarioSaudacaoCompleta,
  iniciaisUsuario,
  primeiroNomeUsuario,
} from './utils/formatUsuarioExibicao';
import { listaMenuOutrosSistemas } from './utils/sistemaDestinosMenu';
import { usuarioPodeAcessarOrionAgenda } from './utils/sistemaAccess';

const DOC_TITLE = 'Órion Agenda';
const accent = '#2dd4bf';

function iconeMenuOutroSistema(id: string) {
  switch (id) {
    case 'SAD':
      return Description;
    case 'OPERACOES':
      return Hub;
    case 'ORION_QUALIDADE':
      return FactCheck;
    case 'ORION_JURIDICO':
      return Gavel;
    case 'ORION_PATRIMONIO':
      return Inventory2;
    case 'ORION_MULHER':
      return Woman;
    case 'ORION_SUPORTE':
      return SupportAgent;
    case 'ORION_AGENDA':
      return CalendarMonthOutlined;
    default:
      return Description;
  }
}

export default function App() {
  const [publicErr, setPublicErr] = useState<string | null>(null);
  const [sessaoModulo, setSessaoModulo] = useState<OrionAgendaSessao | null>(null);
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarMenuAnchor, setAvatarMenuAnchor] = useState<HTMLElement | null>(null);

  const outrosSistemasMenu = useMemo(
    () => (currentUser ? listaMenuOutrosSistemas(currentUser) : []),
    [currentUser],
  );

  const carregarSessao = useCallback(async () => {
    setBootstrapError(null);
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.getMe();
      if (!usuarioPodeAcessarOrionAgenda(me)) {
        removerTokenSession();
        removerAcessoIdSession();
        setCurrentUser(null);
        setBootstrapError(
          'Seu perfil não tem permissão para o Órion Agenda. Um administrador deve incluir «Órion Agenda» nos sistemas permitidos do seu usuário (Órion SAD → Cadastrar usuários).',
        );
        setLoading(false);
        return;
      }
      setCurrentUser(me);
      try {
        setSessaoModulo(await api.getSessaoModulo());
      } catch {
        setSessaoModulo(null);
      }
    } catch {
      removerTokenSession();
      removerAcessoIdSession();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarSessao();
  }, [carregarSessao]);

  useEffect(() => {
    void api
      .getPublicInfo()
      .then(() => setPublicErr(null))
      .catch((e) => {
        setPublicErr(e instanceof Error ? e.message : 'Falha ao comunicar com a API.');
      });
  }, []);

  useEffect(() => {
    if (bootstrapError && !currentUser) {
      document.title = `${DOC_TITLE} — Sem permissão`;
      return;
    }
    if (currentUser) {
      const sufixo = primeiroNomeUsuario(currentUser.nome) ?? 'Agenda';
      document.title = `${DOC_TITLE} · ${sufixo}`;
    } else {
      document.title = `${DOC_TITLE} · Entrar`;
    }
  }, [currentUser, bootstrapError]);

  function handleLoginSuccess(usuario: Usuario) {
    if (!usuarioPodeAcessarOrionAgenda(usuario)) {
      removerTokenSession();
      removerAcessoIdSession();
      setBootstrapError(
        'Seu perfil não tem permissão para o Órion Agenda. Solicite ao administrador a inclusão do módulo nos sistemas permitidos do seu cadastro no SAD.',
      );
      return;
    }
    setBootstrapError(null);
    setCurrentUser(usuario);
    void (async () => {
      try {
        setSessaoModulo(await api.getSessaoModulo());
      } catch {
        setSessaoModulo(null);
      }
    })();
  }

  async function handleLogout() {
    setAvatarMenuAnchor(null);
    await api.logout();
    setCurrentUser(null);
    setSessaoModulo(null);
    setBootstrapError(null);
  }

  if (loading) {
    return (
      <div className="app-agenda">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: accent }} />
        </Box>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app-agenda app-agenda--auth">
        {bootstrapError ? (
          <Box sx={{ px: 2, pt: 2, maxWidth: 560, mx: 'auto', flexShrink: 0 }}>
            <Alert severity="warning">{bootstrapError}</Alert>
          </Box>
        ) : null}
        <div className="app-agenda__auth-shell">
          <LoginAgendaView onSuccess={handleLoginSuccess} />
        </div>
        <footer className="app-footer app-footer--auth">
          <span className="app-footer__label">Desenvolvido por</span>
          <div className="app-footer__credits">
            <span className="app-footer__name">2º SGT M. Farias · 2º SGT Gadelha</span>
          </div>
          <span className="app-footer__meta">COPOM · {new Date().getFullYear()}</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-agenda">
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderBottom: `1px solid ${alpha(accent, 0.22)}`,
          background: `linear-gradient(
            105deg,
            ${alpha('#0f766e', 0.97)} 0%,
            ${alpha('#0f172a', 0.98)} 42%,
            ${alpha('#14b8a6', 0.32)} 100%
          )`,
          boxShadow: `0 4px 28px -10px ${alpha('#000', 0.55)}`,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <Box
          sx={{
            maxWidth: 1400,
            mx: 'auto',
            px: { xs: 2, sm: 2.5, md: 3 },
            py: { xs: 1.5, sm: 2 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                flexShrink: 0,
                width: { xs: 46, sm: 54 },
                height: { xs: 46, sm: 54 },
                borderRadius: 2.5,
                background: `linear-gradient(145deg, ${alpha(accent, 0.5)} 0%, ${alpha('#0d9488', 0.92)} 50%, ${alpha('#042f2e', 1)} 100%)`,
                border: `1px solid ${alpha(accent, 0.42)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-hidden
            >
              <CalendarMonthOutlined sx={{ fontSize: 28, color: '#f0fdfa' }} />
            </Box>
            <Divider
              orientation="vertical"
              flexItem
              sx={{
                display: { xs: 'none', md: 'block' },
                borderColor: alpha(accent, 0.2),
                alignSelf: 'stretch',
                my: 0.5,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 0.25 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: alpha('#f0fdfa', 0.48),
                    letterSpacing: '0.16em',
                    fontWeight: 600,
                    fontSize: '0.65rem',
                    lineHeight: 1.2,
                  }}
                >
                  COPOM · Ecossistema Órion
                </Typography>
                <Chip
                  icon={<CalendarMonthOutlined sx={{ fontSize: '16px !important', ml: '4px !important' }} />}
                  label="Gestão de compromissos"
                  size="small"
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    bgcolor: alpha(accent, 0.12),
                    color: alpha('#f0fdfa', 0.95),
                    border: `1px solid ${alpha(accent, 0.3)}`,
                    '& .MuiChip-icon': { color: accent },
                  }}
                />
              </Stack>
              <Typography
                component="h1"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.28rem', sm: '1.55rem' },
                  letterSpacing: '-0.035em',
                  color: '#f0fdfa',
                  lineHeight: 1.15,
                }}
              >
                Órion Agenda
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: alpha('#f0fdfa', 0.52),
                  mt: 0.35,
                  maxWidth: 560,
                  lineHeight: 1.45,
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Gerenciamento de horários, reuniões e compromissos institucionais do COPOM.
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  Agenda institucional.
                </Box>
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.75} sx={{ flexShrink: 0 }}>
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                flexDirection: 'column',
                alignItems: 'flex-end',
                pr: 0.25,
                minWidth: 0,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: alpha('#f0fdfa', 0.4),
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                }}
              >
                Sessão
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  textAlign: 'right',
                  lineHeight: 1.35,
                }}
              >
                {formatUsuarioSaudacaoCompleta(currentUser.nome)} —{' '}
                {formatMatricula(currentUser.matricula)}
              </Typography>
            </Box>
            <Box
              sx={{
                p: '3px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${alpha(accent, 0.55)}, ${alpha('#042f2e', 0.35)})`,
              }}
            >
              <IconButton
                onClick={(e) => setAvatarMenuAnchor(e.currentTarget)}
                aria-label="Menu do usuário"
                aria-controls={avatarMenuAnchor ? 'user-menu-agenda' : undefined}
                aria-haspopup="true"
                aria-expanded={avatarMenuAnchor ? 'true' : undefined}
                sx={{ p: 0 }}
              >
                <Avatar
                  src={currentUser.fotoUrl ?? undefined}
                  sx={{
                    width: 42,
                    height: 42,
                    bgcolor: '#0f766e',
                    fontSize: '1rem',
                    border: `2px solid ${alpha('#0f172a', 0.9)}`,
                  }}
                >
                  {iniciaisUsuario(currentUser.nome)}
                </Avatar>
              </IconButton>
            </Box>
          </Stack>
        </Box>
      </Box>

      <Menu
        id="user-menu-agenda"
        anchorEl={avatarMenuAnchor}
        open={Boolean(avatarMenuAnchor)}
        onClose={() => setAvatarMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1.5 } } }}
      >
        {outrosSistemasMenu.map((item) => {
          const Icon = iconeMenuOutroSistema(item.id);
          return (
            <MenuItem
              key={item.id}
              onClick={() => {
                setAvatarMenuAnchor(null);
                const t = getToken();
                const url = t ? buildUrlComHandoffJwt(item.url, t) : item.url;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              <Icon sx={{ mr: 1.5, fontSize: 20 }} />
              {item.label}
            </MenuItem>
          );
        })}
        <MenuItem
          onClick={() => {
            void handleLogout();
          }}
        >
          <Logout sx={{ mr: 1.5, fontSize: 20 }} />
          Sair
        </MenuItem>
      </Menu>

      <main className="app-agenda__main">
        <AgendaInicioSection
          usuario={currentUser}
          publicErr={publicErr}
          sessao={sessaoModulo}
        />
      </main>

      <footer className="app-footer">
        <span className="app-footer__label">Desenvolvido por</span>
        <div className="app-footer__credits">
          <span className="app-footer__name">2º SGT M. Farias · 2º SGT Gadelha</span>
        </div>
        <span className="app-footer__meta">COPOM · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
