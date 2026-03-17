import { useState } from 'react';
import { api } from '../../api';
import type { LoginInput, Usuario } from '../../types';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Verified, Shield, Groups, Lock, Visibility, VisibilityOff } from '@mui/icons-material';

interface LoginViewProps {
  onSuccess: (loginResponse: { accessToken: string; usuario: Usuario }) => void;
  onForgotPassword: () => void;
}

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

  return (
    <Box
      sx={{
        width: '100%',
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' },
        alignItems: 'stretch',
      }}
    >
      <Box
        sx={{
          borderRadius: 3,
          p: { xs: 3, md: 4 },
          color: 'white',
          backgroundColor: 'var(--sentinela-navy)',
          backgroundImage:
            "linear-gradient(135deg, rgba(11, 31, 75, 0.92) 0%, rgba(30, 58, 138, 0.9) 45%, rgba(37, 99, 235, 0.88) 100%), url('/pmdf-logo.webp')",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 28px bottom 28px',
          backgroundSize: { xs: '120px', md: '160px' },
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.35)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          rowGap: 3,
          minHeight: { xs: 'auto', md: 420 },
        }}
      >
        <Stack spacing={3}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
              <Lock />
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                COPOM · Gestão de Pessoal
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Acesso seguro ao painel operacional.
              </Typography>
            </Box>
          </Stack>

          <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: 360 }}>
            Centralize o controle de afastamentos, efetivo e escala em um único lugar,
            com rastreabilidade e governança.
          </Typography>

          <List dense sx={{ px: 0 }}>
            <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
              <ListItemIcon sx={{ minWidth: 36, color: 'white' }}>
                <Verified />
              </ListItemIcon>
              <ListItemText primary="Auditoria e histórico completos." />
            </ListItem>
            <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
              <ListItemIcon sx={{ minWidth: 36, color: 'white' }}>
                <Shield />
              </ListItemIcon>
              <ListItemText primary="Camadas de segurança por nível." />
            </ListItem>
            <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
              <ListItemIcon sx={{ minWidth: 36, color: 'white' }}>
                <Groups />
              </ListItemIcon>
              <ListItemText primary="Visão rápida do efetivo." />
            </ListItem>
          </List>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
          <Chip label="COPOM" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: 'white' }} />
          <Chip label="Acesso restrito" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: 'white' }} />
          <Chip label="Rede interna" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: 'white' }} />
        </Stack>
      </Box>

      <Card
        sx={{
          width: '100%',
          boxShadow: '0 18px 50px rgba(15, 23, 42, 0.12)',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Acessar o sistema
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Entre com a matrícula e a senha cadastrada.
              </Typography>
            </Box>

            <Divider />

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Matrícula"
                  value={form.matricula}
                  onChange={(event) => handleChange('matricula', event.target.value)}
                  placeholder="Ex: 23456x"
                  autoComplete="username"
                  required
                  fullWidth
                />
                <TextField
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  value={form.senha}
                  onChange={(event) => handleChange('senha', event.target.value)}
                  placeholder="Digite a senha"
                  autoComplete="current-password"
                  required
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          onClick={() => setShowPassword((prev) => !prev)}
                          edge="end"
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
                  sx={{ py: 1.2, fontWeight: 600 }}
                >
                  {loading ? 'Logando...' : 'Entrar'}
                </Button>
                <Button
                  type="button"
                  variant="text"
                  onClick={onForgotPassword}
                  sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                >
                  Esqueci minha senha
                </Button>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
