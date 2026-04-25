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
import { Hub, Visibility, VisibilityOff } from '@mui/icons-material';
import { api } from '../api';
import type { LoginInput, Usuario } from '../types';

const accent = '#f59e0b';
const cardBg = 'rgba(15, 23, 42, 0.88)';

interface LoginOperacoesViewProps {
  onSuccess: (usuario: Usuario) => void;
}

export function LoginOperacoesView({ onSuccess }: LoginOperacoesViewProps) {
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
    '& .MuiInputLabel-root': { color: alpha('#fef3c7', 0.65) },
    '& .MuiOutlinedInput-input': { color: '#fefce8' },
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
    <Box
      sx={{
        width: '100%',
        maxWidth: 960,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Box
        component="header"
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderRadius: 2,
          border: `1px solid ${alpha(accent, 0.28)}`,
          background: `linear-gradient(105deg, ${alpha('#b45309', 0.92)} 0%, ${alpha('#0f172a', 0.96)} 55%, ${alpha('#f59e0b', 0.22)} 100%)`,
          boxShadow: `0 4px 24px ${alpha('#000', 0.35)}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" sx={{ gap: 1.5 }}>
          <Hub sx={{ fontSize: 32, color: accent }} aria-hidden />
          <Box>
            <Typography
              variant="overline"
              sx={{
                color: alpha('#fef3c7', 0.5),
                letterSpacing: '0.14em',
                fontWeight: 600,
                fontSize: '0.65rem',
                display: 'block',
                lineHeight: 1.2,
              }}
            >
              COPOM · Ecossistema Órion
            </Typography>
            <Typography
              component="h1"
              variant="h5"
              sx={{ fontWeight: 800, color: '#fefce8', letterSpacing: '-0.02em', mt: 0.5 }}
            >
              Órion Operações
            </Typography>
            <Typography variant="body2" sx={{ color: alpha('#fef3c7', 0.65), mt: 0.5, maxWidth: 640 }}>
              <strong>Módulo em estruturação.</strong> Use matrícula e senha do cadastro no SAD.
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: { xs: 1, sm: 2 },
          px: 0,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 420,
            p: { xs: 2.5, sm: 3 },
            borderRadius: 3,
            bgcolor: cardBg,
            border: `1px solid ${alpha(accent, 0.2)}`,
            boxShadow: `0 20px 60px ${alpha('#000', 0.45)}`,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fefce8', mb: 2 }}>
            Entrar
          </Typography>
          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}
          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Matrícula"
                value={form.matricula}
                onChange={(e) => setForm((f) => ({ ...f, matricula: e.target.value }))}
                autoComplete="username"
                fullWidth
                sx={fieldSx}
              />
              <TextField
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                value={form.senha}
                onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                autoComplete="current-password"
                fullWidth
                sx={fieldSx}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        sx={{ color: alpha('#fef3c7', 0.6) }}
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
                disabled={loading}
                fullWidth
                sx={{
                  mt: 1,
                  py: 1.25,
                  fontWeight: 700,
                  bgcolor: accent,
                  color: '#1c1917',
                  '&:hover': { bgcolor: '#fbbf24' },
                }}
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>
            </Stack>
          </form>
        </Paper>
      </Box>
    </Box>
  );
}
