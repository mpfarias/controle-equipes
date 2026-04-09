import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CallSplit, FactCheck, Visibility, VisibilityOff } from '@mui/icons-material';
import { api } from '../api';
import type { LoginInput, Usuario } from '../types';

const accent = '#38bdf8';
const cardBg = 'rgba(15, 23, 42, 0.88)';

interface LoginQualidadeViewProps {
  onSuccess: (usuario: Usuario) => void;
}

export function LoginQualidadeView({ onSuccess }: LoginQualidadeViewProps) {
  const [form, setForm] = useState<LoginInput>({ matricula: '', senha: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: alpha('#020617', 0.55),
      borderRadius: 2,
      '& fieldset': { borderColor: alpha(accent, 0.25) },
      '&:hover fieldset': { borderColor: alpha(accent, 0.5) },
      '&.Mui-focused fieldset': { borderColor: accent, borderWidth: 2 },
    },
    '& .MuiInputLabel-root': { color: alpha('#e0f2fe', 0.65) },
    '& .MuiOutlinedInput-input': { color: '#e0f2fe' },
  } as const;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.matricula.trim() || !form.senha) {
      setError('Informe matrícula e senha.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.login({
        matricula: form.matricula.trim(),
        senha: form.senha,
      });
      onSuccess(res.usuario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box
        component="header"
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderBottom: `1px solid ${alpha(accent, 0.28)}`,
          background: `linear-gradient(90deg, ${alpha('#0c4a6e', 0.95)} 0%, ${alpha('#0f172a', 0.92)} 100%)`,
          boxShadow: `0 4px 24px ${alpha('#000', 0.35)}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" sx={{ gap: 1.5 }}>
          <CallSplit sx={{ fontSize: 32, color: accent }} aria-hidden />
          <Box>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography
                component="h1"
                variant="h5"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#e0f2fe',
                  lineHeight: 1.2,
                }}
              >
                Órion Qualidade
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: alpha('#e0f2fe', 0.62), mt: 0.5, maxWidth: 640 }}>
              <strong>Gestão da qualidade.</strong> Isto não é o Órion SAD (efetivo, escalas, afastamentos). Você
              precisa <strong>entrar de novo aqui</strong> — a sessão do SAD, em outra aba, continua só lá.
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
          px: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            maxWidth: 440,
            width: '100%',
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: 3,
            border: `1px solid ${alpha(accent, 0.35)}`,
            bgcolor: cardBg,
            boxShadow: `0 0 0 1px ${alpha(accent, 0.08)}, 0 24px 48px ${alpha('#000', 0.45)}`,
          }}
        >
          <Stack spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
            <FactCheck sx={{ fontSize: 44, color: accent }} aria-hidden />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: accent, textAlign: 'center' }}>
              Acesso ao módulo Qualidade
            </Typography>
          </Stack>

          <Alert
            severity="info"
            icon={false}
            sx={{
              mb: 2.5,
              bgcolor: alpha(accent, 0.12),
              color: '#bae6fd',
              border: `1px solid ${alpha(accent, 0.35)}`,
              '& .MuiAlert-message': { width: '100%' },
            }}
          >
            <Typography variant="body2" component="span" sx={{ display: 'block', lineHeight: 1.55 }}>
              Use a <strong>mesma matrícula e senha</strong> do cadastro institucional (a mesma da API), mas este login
              abre <strong>somente</strong> o painel de qualidade — é outro sistema no navegador.
            </Typography>
          </Alert>

          <Box component="form" onSubmit={(e) => void handleSubmit(e)} noValidate>
            {error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            ) : null}
            <Stack spacing={2}>
              <TextField
                label="Matrícula"
                value={form.matricula}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9xX]/g, '').toUpperCase();
                  setForm((p) => ({ ...p, matricula: v }));
                }}
                required
                fullWidth
                sx={fieldSx}
                autoComplete="username"
              />
              <TextField
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                value={form.senha}
                onChange={(e) => setForm((p) => ({ ...p, senha: e.target.value }))}
                required
                fullWidth
                sx={fieldSx}
                autoComplete="current-password"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          onClick={() => setShowPassword((s) => !s)}
                          edge="end"
                          sx={{ color: alpha('#e0f2fe', 0.55) }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                fullWidth
                sx={{
                  py: 1.35,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '1rem',
                  bgcolor: accent,
                  color: '#0c1222',
                  '&:hover': { bgcolor: '#7dd3fc' },
                }}
              >
                {loading ? 'Entrando no Qualidade…' : 'Entrar no Órion Qualidade'}
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
