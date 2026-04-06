import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CallSplit, Groups, Lock, Logout, PhotoCamera, Visibility, VisibilityOff } from '@mui/icons-material';
import { GestaoChamadosSection } from './gestao/GestaoChamadosSection';
import { LoginSuporteView } from './auth/LoginSuporteView';
import { ImageCropper } from './components/common/ImageCropper';
import { api, getToken, removeToken } from './api';
import type { Usuario } from './types';
import { formatMatricula } from './utils/formatMatricula';
import { getUrlOrionSAD } from './constants/orionSAD';
import { usuarioPodeAcessarOrionSAD } from './utils/sistemaAccess';
import { temAcessoOrionSuporteEfetivo } from './utils/orionSuporteEfetivo';

const DOC_TITLE = 'Órion Suporte — Chamados';

function usuarioPodeAcessarOrionSuporte(user: Usuario): boolean {
  return temAcessoOrionSuporteEfetivo(user);
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

  const podeAcessarSAD = useMemo(
    () => (currentUser ? usuarioPodeAcessarOrionSAD(currentUser) : false),
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
      if (!usuarioPodeAcessarOrionSuporte(me)) {
        removeToken();
        setCurrentUser(null);
        setBootstrapError(
          'Seu perfil não tem permissão para o Órion Suporte. Um administrador deve marcar "Órion Suporte" no seu nível de acesso (Gestão do Sistema → Níveis de acesso).',
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
    if (!usuarioPodeAcessarOrionSuporte(usuario)) {
      removeToken();
      setBootstrapError(
        'Seu perfil não tem permissão para o Órion Suporte. Solicite ao administrador a marcação do nível de acesso.',
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
      <div className="app-suporte">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'var(--suporte-accent)' }} />
        </Box>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app-suporte app-suporte--auth">
        {bootstrapError ? (
          <Box sx={{ px: 2, pt: 2, maxWidth: 560, mx: 'auto' }}>
            <Alert severity="warning">{bootstrapError}</Alert>
          </Box>
        ) : null}
        <LoginSuporteView onSuccess={handleLoginSuccess} />
        <footer className="auth-suporte-footer">
          COPOM · {new Date().getFullYear()} · Órion Suporte (módulo de chamados, separado do Órion SAD)
        </footer>
      </div>
    );
  }

  return (
    <div className="app-suporte">
      <Box
        component="header"
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: `1px solid ${alpha('#2dd4bf', 0.28)}`,
          background: `linear-gradient(90deg, ${alpha('#042f2e', 0.92)} 0%, ${alpha('#0f172a', 0.95)} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" sx={{ gap: 1 }}>
          <CallSplit sx={{ fontSize: 28, color: 'var(--suporte-accent)' }} aria-hidden />
          <Box>
            <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#ecfdf5', letterSpacing: '-0.02em' }}>
                Órion Suporte
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: alpha('#ecfdf5', 0.55), display: 'block', mt: 0.25 }}>
              Gestão de chamados
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', display: { xs: 'none', sm: 'block' } }}>
            {currentUser.nome} — {formatMatricula(currentUser.matricula)}
          </Typography>
          <IconButton
            onClick={(e) => setAvatarMenuAnchor(e.currentTarget)}
            aria-label="Menu do usuário"
            aria-controls={avatarMenuAnchor ? 'user-menu-suporte' : undefined}
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
                border: `1px solid ${alpha('#2dd4bf', 0.35)}`,
              }}
            >
              {getIniciaisUsuario(currentUser.nome)}
            </Avatar>
          </IconButton>
          <Menu
            id="user-menu-suporte"
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
            {podeAcessarSAD ? (
              <MenuItem
                onClick={() => {
                  setAvatarMenuAnchor(null);
                  window.open(getUrlOrionSAD(), '_blank', 'noopener,noreferrer');
                }}
              >
                <Groups sx={{ mr: 1.5, fontSize: 20 }} />
                Órion SAD
              </MenuItem>
            ) : null}
            <MenuItem
              onClick={() => {
                void handleLogout();
              }}
            >
              <Logout sx={{ mr: 1.5, fontSize: 20 }} />
              Sair
            </MenuItem>
          </Menu>
        </Stack>
      </Box>

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
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
          aria-labelledby="alterar-senha-suporte-titulo"
          onClick={closeSenhaModal}
        >
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <h3 id="alterar-senha-suporte-titulo">Alterar senha</h3>
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
                    sx={{ minWidth: 160, textTransform: 'none' }}
                  >
                    {senhaSubmitting ? 'Salvando…' : 'Salvar nova senha'}
                  </Button>
                )}
              </div>
            </Box>
          </div>
        </div>
      )}

      <main className="app-suporte__main">
        <GestaoChamadosSection />
      </main>
    </div>
  );
}
