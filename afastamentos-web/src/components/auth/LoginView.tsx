import { useState } from 'react';
import { api } from '../../api';
import type { LoginInput, Usuario } from '../../types';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Lock,
  Visibility,
  VisibilityOff,
  Hub,
  Security,
  Timeline,
  ArrowForward,
} from '@mui/icons-material';

interface LoginViewProps {
  onSuccess: (loginResponse: { accessToken: string; usuario: Usuario }) => void;
  onForgotPassword: () => void;
}

const accent = '#FF7A1A';
const accentGlow = 'rgba(255, 122, 26, 0.35)';

const featureItems = [
  { icon: <Hub sx={{ fontSize: 22 }} />, title: 'Gestão integrada', sub: 'Controle, planejamento e operação do COPOM' },
  { icon: <Security sx={{ fontSize: 22 }} />, title: 'Automação total', sub: 'Ferramenta estratégica para comando e administração' },
  { icon: <Timeline sx={{ fontSize: 22 }} />, title: 'Visão operacional', sub: 'Indicadores e painéis em tempo real' },
];

export function LoginView({ onSuccess, onForgotPassword }: LoginViewProps) {
  const [form, setForm] = useState<LoginInput>({ matricula: '', senha: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (field: keyof LoginInput, value: string) => {
    if (field === 'matricula') {
      value = value.replace(/[^0-9xX]/g, '').toUpperCase();
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.matricula.trim() || !form.senha) {
      setError('Informe matrícula e senha.');
      return;
    }

    try {
      setLoading(true);
      const loginResponse = await api.login({
        matricula: form.matricula.trim(),
        senha: form.senha,
      });
      onSuccess(loginResponse);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Credenciais inválidas. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: alpha('#0a1628', 0.55),
      borderRadius: 2,
      transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
      '& fieldset': {
        borderColor: alpha('#e8eef4', 0.12),
      },
      '&:hover fieldset': {
        borderColor: alpha(accent, 0.45),
      },
      '&.Mui-focused fieldset': {
        borderColor: accent,
        borderWidth: 1,
      },
      '&.Mui-focused': {
        boxShadow: `0 0 0 3px ${alpha(accent, 0.18)}`,
      },
    },
    '& .MuiInputLabel-root': {
      color: alpha('#e8eef4', 0.65),
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: accent,
    },
    '& .MuiOutlinedInput-input': {
      color: '#e8eef4',
      fontWeight: 500,
      letterSpacing: '0.02em',
    },
    '& .MuiIconButton-root': {
      color: alpha('#e8eef4', 0.55),
      '&:hover': { color: accent },
    },
  } as const;

  return (
    <Box
      sx={{
        width: '100%',
        position: 'relative',
        isolation: 'isolate',
        borderRadius: { xs: 2, md: 3 },
        overflow: 'hidden',
        boxShadow: `
          0 0 0 1px ${alpha('#fff', 0.06)},
          0 24px 80px rgba(0, 0, 0, 0.55),
          0 0 120px ${alpha(accent, 0.06)}
        `,
      }}
    >
      {/* Mesmo fundo global (emblema Órion + scrims), alinhado ao html via fixed */}
      <Box
        className="login-view-bg-layer"
        sx={{ borderRadius: { xs: 2, md: 3 } }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          opacity: 0.45,
          backgroundImage: `
            linear-gradient(${alpha('#e8eef4', 0.04)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha('#e8eef4', 0.04)} 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          '@keyframes loginGridDrift': {
            '0%': { backgroundPosition: '0 0, 0 0' },
            '100%': { backgroundPosition: '48px 48px, 48px 48px' },
          },
          animation: 'loginGridDrift 48s linear infinite',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: -80,
          right: -60,
          width: 280,
          height: 280,
          zIndex: 1,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(accent, 0.1)} 0%, transparent 70%)`,
          filter: 'blur(40px)',
          '@keyframes loginPulse': {
            '0%, 100%': { opacity: 0.28 },
            '50%': { opacity: 0.52 },
          },
          animation: 'loginPulse 8s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.05fr minmax(320px, 0.95fr)' },
          minHeight: { xs: 'auto', md: 460 },
        }}
      >
        {/* Painel esquerdo — identidade tech */}
        <Box
          sx={{
            p: { xs: 3, sm: 4, md: 5 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 3,
            borderRight: { md: `1px solid ${alpha('#fff', 0.06)}` },
            borderBottom: { xs: `1px solid ${alpha('#fff', 0.06)}`, md: 'none' },
            background: `linear-gradient(180deg, ${alpha('#0f2a44', 0.35)} 0%, transparent 100%)`,
          }}
        >
          <Stack spacing={3}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  background: `linear-gradient(145deg, ${alpha(accent, 0.25)} 0%, ${alpha('#0f2a44', 0.9)} 100%)`,
                  border: `1px solid ${alpha(accent, 0.35)}`,
                  boxShadow: `0 0 24px ${accentGlow}`,
                }}
              >
                <Lock sx={{ fontSize: 28, color: accent }} />
              </Box>
              <Box>
                <Typography
                  variant="overline"
                  sx={{
                    letterSpacing: '0.28em',
                    color: alpha('#e8eef4', 0.45),
                    fontWeight: 700,
                    fontSize: '0.65rem',
                  }}
                >
                  AMBIENTE SEGURO
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: '#e8eef4',
                    lineHeight: 1.2,
                  }}
                >
                  Órion
                  <Box component="span" sx={{ color: accent, fontWeight: 800 }}>
                    {' '}
                    · COPOM
                  </Box>
                </Typography>
                <Typography variant="body2" sx={{ color: alpha('#e8eef4', 0.55), mt: 0.5, maxWidth: 380 }}>
                  Plataforma de gestão de pessoal e operações — visão unificada do efetivo.
                </Typography>
              </Box>
            </Stack>

            <Box
              sx={{
                position: 'relative',
                height: 2,
                borderRadius: 1,
                bgcolor: alpha('#fff', 0.06),
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '35%',
                  background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                  '@keyframes loginShimmer': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(400%)' },
                  },
                  animation: 'loginShimmer 3.5s ease-in-out infinite',
                }}
              />
            </Box>

            <Stack spacing={1.75}>
              {featureItems.map((item) => (
                <Stack
                  key={item.title}
                  direction="row"
                  spacing={2}
                  alignItems="flex-start"
                  sx={{
                    py: 1.25,
                    px: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha('#000', 0.2),
                    border: `1px solid ${alpha('#fff', 0.05)}`,
                    transition: 'border-color 0.2s, background-color 0.2s',
                    '&:hover': {
                      borderColor: alpha(accent, 0.25),
                      bgcolor: alpha('#000', 0.28),
                    },
                  }}
                >
                  <Box sx={{ color: accent, mt: 0.25, opacity: 0.95 }}>{item.icon}</Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#e8eef4', fontWeight: 700, letterSpacing: '0.02em' }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: alpha('#e8eef4', 0.5), display: 'block', mt: 0.25 }}>
                      {item.sub}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Box
              sx={{
                px: 1.25,
                py: 0.4,
                borderRadius: 10,
                bgcolor: alpha('#2e8b57', 0.2),
                border: `1px solid ${alpha('#2e8b57', 0.45)}`,
              }}
            >
              <Typography variant="caption" sx={{ color: '#86c99e', fontWeight: 700, letterSpacing: '0.06em' }}>
                SISTEMA ATIVO
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: alpha('#e8eef4', 0.35) }}>
              Conexão criptografada · sessão monitorada
            </Typography>
          </Stack>
        </Box>

        {/* Formulário — glass card */}
        <Box
          sx={{
            p: { xs: 3, sm: 4, md: 5 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: alpha('#050a12', 0.22),
            backdropFilter: 'blur(18px) saturate(1.1)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.1)',
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: 400,
              p: { xs: 2.5, sm: 3 },
              borderRadius: 3,
              background: `linear-gradient(160deg, ${alpha('#1e232a', 0.82)} 0%, ${alpha('#0b1f33', 0.78)} 100%)`,
              border: `1px solid ${alpha('#fff', 0.08)}`,
              boxShadow: `
                inset 0 1px 0 ${alpha('#fff', 0.04)},
                0 16px 48px rgba(0, 0, 0, 0.4)
              `,
            }}
          >
            <Stack spacing={2.5}>
              <Box>
                <Typography
                  variant="overline"
                  sx={{ color: alpha('#e8eef4', 0.45), letterSpacing: '0.2em', fontWeight: 700, fontSize: '0.65rem' }}
                >
                  AUTENTICAÇÃO
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#e8eef4', letterSpacing: '-0.02em', mt: 0.5 }}>
                  Acessar painel
                </Typography>
                <Typography variant="body2" sx={{ color: alpha('#e8eef4', 0.5), mt: 0.75 }}>
                  Informe matrícula e senha institucionais.
                </Typography>
              </Box>

              {error && (
                <Alert
                  severity="error"
                  onClose={() => setError(null)}
                  sx={{
                    bgcolor: alpha('#d64545', 0.12),
                    color: '#f0b4b4',
                    border: `1px solid ${alpha('#d64545', 0.35)}`,
                    '& .MuiAlert-icon': { color: '#d64545' },
                  }}
                >
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2.25}>
                  <TextField
                    label="Matrícula"
                    value={form.matricula}
                    onChange={(event) => handleChange('matricula', event.target.value)}
                    placeholder="Ex.: 23456X"
                    autoComplete="username"
                    required
                    fullWidth
                    sx={fieldSx}
                  />
                  <TextField
                    label="Senha"
                    type={showPassword ? 'text' : 'password'}
                    value={form.senha}
                    onChange={(event) => handleChange('senha', event.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    fullWidth
                    sx={fieldSx}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            onClick={() => setShowPassword((prev) => !prev)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                    endIcon={!loading ? <ArrowForward /> : undefined}
                    sx={{
                      mt: 0.5,
                      py: 1.35,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'none',
                      fontSize: '1rem',
                      borderRadius: 2,
                      bgcolor: accent,
                      color: '#fff',
                      boxShadow: `0 8px 28px ${alpha(accent, 0.4)}`,
                      '&:hover': {
                        bgcolor: '#e66d0f',
                        boxShadow: `0 10px 32px ${alpha(accent, 0.5)}`,
                      },
                      '&:disabled': {
                        bgcolor: alpha(accent, 0.4),
                        color: alpha('#fff', 0.7),
                      },
                    }}
                  >
                    {loading ? 'Entrando…' : 'Entrar'}
                  </Button>
                  <Button
                    type="button"
                    variant="text"
                    onClick={onForgotPassword}
                    sx={{
                      textTransform: 'none',
                      alignSelf: 'center',
                      color: alpha('#e8eef4', 0.55),
                      fontWeight: 600,
                      '&:hover': {
                        color: accent,
                        bgcolor: alpha(accent, 0.06),
                      },
                    }}
                  >
                    Esqueci minha senha
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* Logo institucional discreto */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 20,
          zIndex: 3,
          width: { xs: 72, md: 96 },
          height: { xs: 72, md: 96 },
          opacity: 0.22,
          backgroundImage: "url('/pmdf-logo.webp')",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'contain',
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
}
