import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Description,
  FactCheck,
  Gavel,
  Hub,
  Inventory2,
  Lock,
  Logout,
  PhotoCamera,
  SupportAgent,
  Visibility,
  VisibilityOff,
  Woman,
} from '@mui/icons-material';
import { LoginPatrimonioView } from './auth/LoginPatrimonioView';
import { ImageCropper } from './components/common/ImageCropper';
import { PatrimonioBensSection } from './components/PatrimonioBensSection';
import { api, getToken, removeToken } from './api';
import { buildUrlComHandoffJwt } from './constants/orionEcossistemaAuth';
import type { Usuario } from './types';
import { formatMatricula } from './utils/formatMatricula';
import { listaMenuOutrosSistemas } from './utils/sistemaDestinosMenu';
import { usuarioPodeAcessarOrionPatrimonio } from './utils/sistemaAccess';

const DOC_TITLE = 'Órion Patrimônio';

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
  const [senhaConfirmarValidarAoSair, setSenhaConfirmarValidarAoSair] = useState(false);

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
      if (!usuarioPodeAcessarOrionPatrimonio(me)) {
        removeToken();
        setCurrentUser(null);
        setBootstrapError(
          'Seu perfil não tem permissão para o Órion Patrimônio. Um administrador deve incluir "Órion Patrimônio" nos sistemas permitidos do seu usuário (Órion SAD → Cadastrar usuários).',
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
    if (!usuarioPodeAcessarOrionPatrimonio(usuario)) {
      removeToken();
      setBootstrapError(
        'Seu perfil não tem permissão para o Órion Patrimônio. Solicite ao administrador a inclusão do módulo nos sistemas permitidos do seu cadastro no SAD.',
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
    senhaConfirmarValidarAoSair && senhaConfirmar.length > 0 && senhaNova !== senhaConfirmar;

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
        senhaAtual,
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
      reader.onload = (ev) => {
        const imageSrc = ev.target?.result as string;
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
      const updated = await api.patchMeProfile({ fotoUrl: croppedImageUrl });
      setCurrentUser(updated);
      closeFotoModal();
    } catch (err) {
      setFotoError(err instanceof Error ? err.message : 'Não foi possível salvar a foto.');
    } finally {
      setFotoSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-patrimonio">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'var(--patrimonio-accent)' }} />
        </Box>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app-patrimonio app-patrimonio--auth">
        {bootstrapError ? (
          <Box sx={{ px: 2, pt: 2, maxWidth: 560, mx: 'auto', flexShrink: 0 }}>
            <Alert severity="warning">{bootstrapError}</Alert>
          </Box>
        ) : null}
        <div className="app-patrimonio__auth-shell">
          <LoginPatrimonioView onSuccess={handleLoginSuccess} />
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
    <div className="app-patrimonio">
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderBottom: `1px solid ${alpha('#fbbf24', 0.22)}`,
          background: `linear-gradient(
            105deg,
            ${alpha('#78350f', 0.97)} 0%,
            ${alpha('#0f172a', 0.98)} 42%,
            ${alpha('#d97706', 0.32)} 100%
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
                background: `linear-gradient(145deg, ${alpha('#fbbf24', 0.5)} 0%, ${alpha('#d97706', 0.92)} 50%, ${alpha('#78350f', 1)} 100%)`,
                border: `1px solid ${alpha('#fbbf24', 0.42)}`,
                boxShadow: `${`0 0 0 1px ${alpha('#000', 0.25)} inset`}, 0 10px 32px -14px ${alpha('#fbbf24', 0.4)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 1,
              }}
              aria-hidden
            >
              <Box
                component="img"
                src={`${import.meta.env.BASE_URL}favicon.svg`}
                alt=""
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.35))',
                }}
              />
            </Box>
            <Divider
              orientation="vertical"
              flexItem
              sx={{
                display: { xs: 'none', md: 'block' },
                borderColor: alpha('#fbbf24', 0.2),
                alignSelf: 'stretch',
                my: 0.5,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 0.25 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: alpha('#fffbeb', 0.48),
                    letterSpacing: '0.16em',
                    fontWeight: 600,
                    fontSize: '0.65rem',
                    lineHeight: 1.2,
                  }}
                >
                  COPOM · Ecossistema Órion
                </Typography>
                <Chip
                  icon={<Inventory2 sx={{ fontSize: '16px !important', ml: '4px !important' }} />}
                  label="Patrimônio"
                  size="small"
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    bgcolor: alpha('#fbbf24', 0.12),
                    color: alpha('#fffbeb', 0.95),
                    border: `1px solid ${alpha('#fbbf24', 0.3)}`,
                    '& .MuiChip-icon': { color: 'var(--patrimonio-accent)' },
                  }}
                />
              </Stack>
              <Typography
                component="h1"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.28rem', sm: '1.55rem' },
                  letterSpacing: '-0.035em',
                  color: '#fffbeb',
                  lineHeight: 1.15,
                }}
              >
                Órion Patrimônio
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: alpha('#fffbeb', 0.52),
                  mt: 0.35,
                  maxWidth: 520,
                  lineHeight: 1.45,
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Cadastro, localização e situação dos bens tombados do COPOM.
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  Gestão de bens.
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
                  color: alpha('#fffbeb', 0.4),
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
                background: `linear-gradient(135deg, ${alpha('#fbbf24', 0.55)}, ${alpha('#b45309', 0.35)})`,
              }}
            >
              <IconButton
                onClick={(e) => setAvatarMenuAnchor(e.currentTarget)}
                aria-label="Menu do usuário"
                aria-controls={avatarMenuAnchor ? 'user-menu-patrimonio' : undefined}
                aria-haspopup="true"
                aria-expanded={avatarMenuAnchor ? 'true' : undefined}
                sx={{ p: 0 }}
              >
                <Avatar
                  src={currentUser.fotoUrl ?? undefined}
                  sx={{
                    width: 42,
                    height: 42,
                    bgcolor: 'var(--sentinela-amber)',
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
        id="user-menu-patrimonio"
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

      {fotoModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeFotoModal}>
          <div
            className="modal"
            style={{ maxWidth: showImageCropper ? '800px' : '420px' }}
            onClick={(e) => e.stopPropagation()}
          >
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
                  onKeyDown={(ev) => ev.key === 'Enter' && fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 48,
                    backgroundColor: 'rgba(28, 25, 23, 0.72)',
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
          aria-labelledby="alterar-senha-patrimonio-titulo"
          onClick={closeSenhaModal}
        >
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <h3 id="alterar-senha-patrimonio-titulo">Alterar senha</h3>
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
                    sx={{
                      minWidth: 160,
                      textTransform: 'none',
                      bgcolor: 'var(--patrimonio-accent-dim)',
                      '&:hover': { bgcolor: 'var(--btn-primary-hover)' },
                    }}
                  >
                    {senhaSubmitting ? 'Salvando…' : 'Salvar nova senha'}
                  </Button>
                )}
              </div>
            </Box>
          </div>
        </div>
      )}

      <main className="app-patrimonio__main">
        <PatrimonioBensSection />
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
