import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api, getToken } from './api';
import type { OrionJuridicoPublicInfo, OrionJuridicoSessao, Usuario } from './types';

const DOC_TITLE = 'Órion Jurídico';

export default function App() {
  const [publicInfo, setPublicInfo] = useState<OrionJuridicoPublicInfo | null>(null);
  const [publicErr, setPublicErr] = useState<string | null>(null);
  const [sessaoModulo, setSessaoModulo] = useState<OrionJuridicoSessao | null>(null);
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = DOC_TITLE;
  }, []);

  useEffect(() => {
    void api
      .getPublicInfo()
      .then(setPublicInfo)
      .catch((e) => setPublicErr(e instanceof Error ? e.message : 'Falha ao carregar API.'));
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setSessaoModulo(null);
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.getMe();
      setUser(me);
      try {
        setSessaoModulo(await api.getSessaoModulo());
      } catch {
        setSessaoModulo(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr(null);
    setSubmitting(true);
    try {
      await api.login({ matricula: matricula.trim(), senha });
      setSenha('');
      await bootstrap();
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : 'Falha no login.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setSessaoModulo(null);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Órion Jurídico
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Módulo em estruturação — autenticação compartilhada com o ecossistema Órion (API única).
      </Typography>

      {publicErr && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {publicErr}
        </Alert>
      )}
      {publicInfo && (
        <Alert severity="info" sx={{ mb: 2 }}>
          API: {publicInfo.nome} · versão {publicInfo.versao} · {publicInfo.fase}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : user ? (
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              Olá, <strong>{user.nome}</strong> ({user.matricula})
            </Typography>
            {sessaoModulo && (
              <Alert severity="success">
                {sessaoModulo.mensagem}
              </Alert>
            )}
            <Button variant="outlined" color="inherit" onClick={() => void handleLogout()}>
              Sair
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Paper component="form" onSubmit={(e) => void handleLogin(e)} sx={{ p: 2, maxWidth: 400 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Entrar</Typography>
            {loginErr && <Alert severity="error">{loginErr}</Alert>}
            <TextField
              label="Matrícula"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              required
              autoComplete="username"
              fullWidth
            />
            <TextField
              label="Senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
