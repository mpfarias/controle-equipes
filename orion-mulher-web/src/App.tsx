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
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Description,
  FactCheck,
  Gavel,
  Hub,
  InfoOutlined,
  Inventory2,
  Logout,
  SupportAgent,
  Woman,
} from '@mui/icons-material';
import { LoginMulherView } from './auth/LoginMulherView';
import { api, getToken, removeToken } from './api';
import { buildUrlComHandoffJwt } from './constants/orionEcossistemaAuth';
import type { Usuario } from './types';
import { formatMatricula } from './utils/formatMatricula';
import { listaMenuOutrosSistemas } from './utils/sistemaDestinosMenu';
import { usuarioPodeAcessarOrionMulher } from './utils/sistemaAccess';

const DOC_TITLE = 'Órion Mulher';
const accent = '#f472b6';

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
    case 'ORION_SUPORTE':
      return SupportAgent;
    case 'ORION_MULHER':
      return Woman;
    default:
      return Description;
  }
}

function getIniciaisUsuario(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

export default function App() {
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
      if (!usuarioPodeAcessarOrionMulher(me)) {
        removeToken();
        setCurrentUser(null);
        setBootstrapError(
          'Seu perfil não tem permissão para o Órion Mulher. Um administrador deve incluir "Órion Mulher" nos sistemas permitidos do seu usuário (Órion SAD → Cadastrar usuários).',
        );
        setLoading(false);
        return;
      }
      setCurrentUser(me);
    } catch {
      removeToken();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarSessao();
  }, [carregarSessao]);

  useEffect(() => {
    if (bootstrapError && !currentUser) {
      document.title = `${DOC_TITLE} — Sem permissão`;
      return;
    }
    if (currentUser) {
      document.title = `${DOC_TITLE} · ${currentUser.nome.split(' ')[0] ?? 'Painel'}`;
    } else {
      document.title = `${DOC_TITLE} · Entrar`;
    }
  }, [currentUser, bootstrapError]);

  function handleLoginSuccess(usuario: Usuario) {
    if (!usuarioPodeAcessarOrionMulher(usuario)) {
      removeToken();
      setBootstrapError(
        'Seu perfil não tem permissão para o Órion Mulher. Solicite ao administrador a inclusão do módulo nos sistemas permitidos do seu cadastro no SAD.',
      );
      return;
    }
    setBootstrapError(null);
    setCurrentUser(usuario);
  }

  async function handleLogout() {
    setAvatarMenuAnchor(null);
    await api.logout();
    setCurrentUser(null);
    setBootstrapError(null);
  }

  if (loading) {
    return (
      <div className="app-mulher">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: accent }} />
        </Box>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app-mulher app-mulher--auth">
        {bootstrapError ? (
          <Box sx={{ px: 2, pt: 2, maxWidth: 560, mx: 'auto', flexShrink: 0 }}>
            <Alert severity="warning">{bootstrapError}</Alert>
          </Box>
        ) : null}
        <div className="app-mulher__auth-shell">
          <LoginMulherView onSuccess={handleLoginSuccess} />
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
    <div className="app-mulher">
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderBottom: `1px solid ${alpha(accent, 0.22)}`,
          background: `linear-gradient(
            105deg,
            ${alpha('#831843', 0.97)} 0%,
            ${alpha('#0f172a', 0.98)} 42%,
            ${alpha('#be185d', 0.32)} 100%
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
                background: `linear-gradient(145deg, ${alpha(accent, 0.5)} 0%, ${alpha('#be185d', 0.92)} 50%, ${alpha('#831843', 1)} 100%)`,
                border: `1px solid ${alpha(accent, 0.42)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-hidden
            >
              <Woman sx={{ fontSize: 28, color: '#fdf2f8' }} />
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
                    color: alpha('#fdf2f8', 0.48),
                    letterSpacing: '0.16em',
                    fontWeight: 600,
                    fontSize: '0.65rem',
                    lineHeight: 1.2,
                  }}
                >
                  COPOM · Ecossistema Órion
                </Typography>
                <Chip
                  icon={<Woman sx={{ fontSize: '16px !important', ml: '4px !important' }} />}
                  label="Mulher"
                  size="small"
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    bgcolor: alpha(accent, 0.12),
                    color: alpha('#fdf2f8', 0.95),
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
                  color: '#fdf2f8',
                  lineHeight: 1.15,
                }}
              >
                Órion Mulher
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: alpha('#fdf2f8', 0.52),
                  mt: 0.35,
                  maxWidth: 520,
                  lineHeight: 1.45,
                }}
              >
                Violência doméstica — relatórios e documentos (em construção).
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
                  color: alpha('#fdf2f8', 0.4),
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
                {currentUser.nome} — {formatMatricula(currentUser.matricula)}
              </Typography>
            </Box>
            <Box
              sx={{
                p: '3px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${alpha(accent, 0.55)}, ${alpha('#831843', 0.35)})`,
              }}
            >
              <IconButton
                onClick={(e) => setAvatarMenuAnchor(e.currentTarget)}
                aria-label="Menu do usuário"
                aria-controls={avatarMenuAnchor ? 'user-menu-mulher' : undefined}
                aria-haspopup="true"
                aria-expanded={avatarMenuAnchor ? 'true' : undefined}
                sx={{ p: 0 }}
              >
                <Avatar
                  src={currentUser.fotoUrl ?? undefined}
                  sx={{
                    width: 42,
                    height: 42,
                    bgcolor: '#be185d',
                    fontSize: '1rem',
                    border: `2px solid ${alpha('#0f172a', 0.9)}`,
                  }}
                >
                  {getIniciaisUsuario(currentUser.nome)}
                </Avatar>
              </IconButton>
            </Box>
          </Stack>
        </Box>
      </Box>

      <Menu
        id="user-menu-mulher"
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

      <main className="app-mulher__main">
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 2,
            bgcolor: alpha('#0f172a', 0.65),
            border: `1px solid ${alpha(accent, 0.2)}`,
          }}
        >
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <InfoOutlined sx={{ color: accent, fontSize: 32, mt: 0.25 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#fdf2f8', mb: 1 }}>
                Módulo em desenvolvimento
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Em desenvolvimento
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </main>

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
