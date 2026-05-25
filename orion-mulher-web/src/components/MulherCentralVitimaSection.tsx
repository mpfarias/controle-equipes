import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { api } from '../api';
import type { MulherVitimaCadastroMobile, MulherVitimaPanicoMobile } from '../types';

const accent = '#f472b6';

function formatQuando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

export function MulherCentralVitimaSection() {
  const [cadastros, setCadastros] = useState<MulherVitimaCadastroMobile[]>([]);
  const [panicos, setPanico] = useState<MulherVitimaPanicoMobile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, p] = await Promise.all([api.listCentralCadastros(), api.listCentralPanico()]);
      setCadastros(c);
      setPanico(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar central.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: accent }} />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fdf2f8', flex: 1 }}>
          Central — App da vítima
        </Typography>
        <IconButton aria-label="Atualizar" onClick={() => void carregar()} sx={{ color: accent }}>
          <Refresh />
        </IconButton>
      </Stack>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Pânicos recentes
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 3, bgcolor: alpha('#0f172a', 0.65), border: `1px solid ${alpha(accent, 0.15)}` }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Quando</TableCell>
              <TableCell>Telefone</TableCell>
              <TableCell>Vítima</TableCell>
              <TableCell>Coordenadas</TableCell>
              <TableCell>Encaminhamento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {panicos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  Nenhum pânico registrado.
                </TableCell>
              </TableRow>
            ) : (
              panicos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatQuando(p.createdAt)}</TableCell>
                  <TableCell>{p.telefoneDigits}</TableCell>
                  <TableCell>{p.cadastro?.nomeVitima ?? '—'}</TableCell>
                  <TableCell>
                    {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                  </TableCell>
                  <TableCell>{p.encaminhamento ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Cadastros pelo app
      </Typography>
      <TableContainer component={Paper} sx={{ bgcolor: alpha('#0f172a', 0.65), border: `1px solid ${alpha(accent, 0.15)}` }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Quando</TableCell>
              <TableCell>Telefone</TableCell>
              <TableCell>Vítima</TableCell>
              <TableCell>Endereço</TableCell>
              <TableCell>Agressor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cadastros.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  Nenhum cadastro pelo app.
                </TableCell>
              </TableRow>
            ) : (
              cadastros.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{formatQuando(c.createdAt)}</TableCell>
                  <TableCell>{c.telefoneDigits}</TableCell>
                  <TableCell>{c.nomeVitima ?? '—'}</TableCell>
                  <TableCell>{c.enderecoResidencia ?? '—'}</TableCell>
                  <TableCell>{c.nomeAgressor ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
